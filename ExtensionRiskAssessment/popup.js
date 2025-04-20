document.addEventListener("DOMContentLoaded", () => {
  // ✅ Warn if API key is missing
  chrome.storage.sync.get(["openaiApiKey"], (result) => {
    if (!result.openaiApiKey) {
      const warning = document.createElement("p");
      warning.textContent = "⚠️ Warning: No OpenAI API key found. Go to settings to enter one.";
      warning.style.color = "red";
      document.body.prepend(warning);
    }
  });

  // ✅ Settings button behavior
  const settingsBtn = document.getElementById("openSettingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // 🧠 Add other logic or event listeners here (e.g., form submission, scan button)
});

document.getElementById('downloadCRX').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const match = tab.url.match(/\/([a-z]{32})(?=[\/#?]|$)/);
  if (match && match[1]) {
    chrome.runtime.sendMessage({ action: "download-crx", extensionId: match[1] });
  } else {
    alert("⚠️ Could not extract extension ID from the URL.");
  }
};

document.getElementById("generateLink").onclick = async () => {
  const extId = document.getElementById("extIdInput").value.trim();
  if (extId.length !== 32) {
    alert("Invalid Extension ID");
    return;
  }

  const link = `https://chrome.google.com/webstore/detail/${extId}`;

  // Pre-store a 'loading' placeholder to avoid losing everything on popup close
  chrome.storage.local.set({
    partialMetadata: {
      extensionId: extId,
      status: "loading"
    }
  });

  // Set the link visually — but DON'T make it a clickable anchor yet
  const linkArea = document.getElementById("linkArea");
  linkArea.innerHTML = "Loading store page...";
  linkArea.style.pointerEvents = "none"; // disable click temporarily
  linkArea.style.color = "gray";

  try {
    const metadata = await fetchExtensionInfo(extId);

    document.getElementById("result").textContent =
      `⭐ Rating: ${metadata.rating ?? "N/A"}\n` +
      `👥 Users: ${metadata.users?.toLocaleString() ?? "N/A"}`;

    // ✅ Save full metadata
    chrome.storage.local.set({ partialMetadata: metadata });

    // After saving — update the link and restore click behavior
    setTimeout(() => {
      linkArea.innerHTML = `<a href="${link}" target="_blank">${link}</a>`;
      linkArea.style.pointerEvents = "auto";
      linkArea.style.color = "inherit";

      // Optionally auto-open in new tab
      // window.open(link, "_blank");
    }, 250); // Give time for storage to complete

  } catch (err) {
    document.getElementById("result").textContent = "❌ Failed to fetch extension info.";
    linkArea.innerHTML = `<a href="${link}" target="_blank">${link}</a>`;
    linkArea.style.pointerEvents = "auto";
    linkArea.style.color = "inherit";
  }
};

document.getElementById("extractManifest").onclick = async () => {
  const file = document.getElementById("crxUpload").files[0];
  if (!file) return alert("Please upload a CRX file first.");

  const reader = new FileReader();
  reader.onload = async () => {
    const buf = new Uint8Array(reader.result);

    // Step 1: Extract ZIP portion from CRX
    let zipStartOffset;
    if (buf[4] === 2) {
      zipStartOffset = 16 +
        (buf[8] | buf[9] << 8 | buf[10] << 16 | buf[11] << 24) +
        (buf[12] | buf[13] << 8 | buf[14] << 16 | buf[15] << 24);
    } else {
      zipStartOffset = 12 + (buf[8] | buf[9] << 8 | buf[10] << 16 | buf[11] << 24);
    }

    const zipData = buf.slice(zipStartOffset);
    const zip = await JSZip.loadAsync(zipData);

    // Step 2: Extract manifest.json
    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) {
      alert("❌ manifest.json not found in the CRX file.");
      return;
    }
    const manifestText = await manifestFile.async("string");
    const manifest = JSON.parse(manifestText);

    // Step 3: Extract localization messages if needed
    let messages = {};
    const allLocales = Object.keys(zip.files).filter(name =>
      name.startsWith("_locales/") && name.endsWith("messages.json")
    );

    // Try to use English first
    const preferredLocale = allLocales.find(name => name.includes("_locales/en/")) || allLocales[0];

    if (preferredLocale) {
      try {
        const messagesText = await zip.file(preferredLocale).async("string");
        messages = JSON.parse(messagesText);
      } catch (err) {
        console.warn("Could not parse messages.json", err);
      }
    }


    // Step 4: Resolve localized __MSG_...__ fields
    function resolveLocalizedField(field) {
      const match = field.match(/^__MSG_(.*?)__$/);
      if (match) {
        const key = match[1];
        return messages?.[key]?.message || field;
      }
      return field;
    }

    manifest.name = resolveLocalizedField(manifest.name);
    manifest.description = resolveLocalizedField(manifest.description);
    const allPermissions = [
      ...(manifest.permissions || []),
      ...(manifest.host_permissions || [])
    ];
    

    // Step 5: Get stored stats and merge
    chrome.storage.local.get("partialMetadata", (result) => {
      const stats = result.partialMetadata || {};
      const combinedMetadata = { ...manifest, ...stats };
      combinedMetadata.all_permissions = allPermissions;

      chrome.storage.local.set({ extensionMetadata: combinedMetadata });

      const permissionList = allPermissions.length > 0
      ? allPermissions.join(", ")
      : "None";

    document.getElementById("result").textContent =
      `✅ Metadata ready:\n\n` +
      `🧩 Name: ${combinedMetadata.name}\n` +
      `📦 Version: ${combinedMetadata.version}\n` +
      `📝 Description: ${combinedMetadata.description?.slice(0, 200)}...\n` +
      `⭐ Rating: ${combinedMetadata.rating ?? "N/A"}\n` +
      `👥 Users: ${combinedMetadata.users?.toLocaleString() ?? "N/A"}\n` +
      `🔐 Permissions: ${permissionList}`;

    // Step 6: Send the metadata to the background script
    chrome.runtime.sendMessage({
      action: "assessThreat",
      metadata: {
        name: combinedMetadata.name,
        permissions: permissionList,
        rating: combinedMetadata.rating,
        users: combinedMetadata.users
      }
    }, (response) => {
      console.log("Risk assessment:", response);
      // If response is a string (fallback or error message), show as-is
      if (typeof response === "string") {
        document.getElementById("result").textContent += `\n\n${response}`;
        return;
      }

      // If it's an object from OpenAI with structured info
      document.getElementById("result").textContent +=
        `\n\n🔎 Risk Assessment:\n` +
        `🛡️ Risk Level: ${response.risk_level}\n` +
        `📊 Threat Score: ${response.threat_score}\n` +
        `💬 ${response.explanation}`;
      });
    });

    
  };

  reader.readAsArrayBuffer(file);
};

async function fetchStats(extensionId) {
  const response = await fetch("http://localhost:3000/stats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ extensionId })
  });

  if (!response.ok) {
    throw new Error("Failed to fetch extension stats");
  }

  return await response.json();
}

async function fetchExtensionInfo(extId) {
  const url = `http://localhost:3000/extension/${extId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch extension info");
    }

    const metadata = await response.json();
    return metadata;
  } catch (err) {
    console.error("Error fetching extension info:", err);
    throw err;
  }
}

function resolveLocalizedField(field, messages) {
  const match = field.match(/^__MSG_(.*?)__$/);
  if (match) {
    const key = match[1];
    return messages?.[key]?.message || field;
  }
  return field;
}



