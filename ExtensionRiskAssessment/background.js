const systemPrompt = `
You are an expert in Chrome extension security analysis.

You will receive metadata about a Chrome extension. Respond ONLY with valid JSON in this exact format, with no preamble or commentary:

{
  "risk_level": "Low" | "Medium" | "High" | "Critical",
  "threat_score": number (0-10),
  "explanation": "A short explanation (1-2 sentences)."
}

You must assess its potential threat level based on the following heuristic

Permissions Risk (capabilityScore):
- Estimate how powerful or privacy-sensitive the extension's permissions are, on a scale from 0 to 10.
  - Example scores:
    - Low-risk permissions: storage, notifications → +1 each
    - Medium-risk permissions: tabs, scripting, webRequest → +2 each
    - High-risk permissions: webRequestBlocking, clipboardWrite, fileSystem, "<all_urls>" → +3 each
  - Cap total at 10.

Trust Factor (0.0–1.0):
- Based on user count and rating.
  - userScore = log10(users) / 7
  - ratingScore = (rating - 3.5) / 1.5
  - trustFactor = average of userScore and ratingScore, clamped between 0.0 and 1.0

Threat Score:
- Compute: threatScore = capabilityScore × (1 - trustFactor)
- Normalize threatScore to a scale from 0 to 10

Threat Levels:
- 0–2 → Low risk
- 2–5 → Medium risk
- 5–7 → High risk
- 7–10 → Critical risk

---

Output Format:
- Risk Level: (Low/Medium/High/Critical)
- Threat Score: (number out of 10)
- Short Explanation: summarize the analysis in 1–2 sentences, noting the identified risk factors.

Be cautious but fair: powerful permissions alone are not enough to judge an extension as dangerous if it has a large and satisfied user base.
          `.trim()

function getChromeVersion() {
  const pieces = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);
  if (!pieces || pieces.length !== 5) return "112.0.0.0"; // fallback
  return `${pieces[1]}.${pieces[2]}.${pieces[3]}.${pieces[4]}`;
}

function getNaclArch() {
  if (navigator.userAgent.includes("x64")) return "x86-64";
  if (navigator.userAgent.includes("x86")) return "x86-32";
  return "arm";
}

function downloadCRX(extensionId) {
  const version = getChromeVersion();
  const nacl_arch = getNaclArch();
  const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${version}&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc&nacl_arch=${nacl_arch}`;

  chrome.downloads.download({
    url: crxUrl,
    filename: `${extensionId}.crx`,
    saveAs: true
  }, () => {
    if (chrome.runtime.lastError) {
      alert("❌ Download failed: " + chrome.runtime.lastError.message);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "download-crx" && request.extensionId) {
    downloadCRX(request.extensionId);
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "assessThreat") {
    assessExtensionRisk(message.metadata).then(result => {
      sendResponse(result);
    });
    return true; // Keep the message channel open for async response
  }
});

async function assessExtensionRisk(extensionMetadata) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['openaiApiKey'], async (result) => {
      const apiKey = result.openaiApiKey;
      if (!apiKey) {
        resolve({
          risk_level: "Unknown",
          threat_score: "N/A",
          explanation: "❌ No OpenAI API key was found. Please enter it in the settings page."
        });
        return;
      }

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: JSON.stringify(extensionMetadata, null, 2)
              }
            ],
            temperature: 0.3
          })
        });

        const data = await response.json();
        if (!data.choices || !Array.isArray(data.choices)) {
          // OpenAI returned an error
          resolve({
            risk_level: "Error",
            threat_score: "N/A",
            explanation: `❌ OpenAI API Error: ${data.error?.message || "Unknown error"}`
          });
          return;
        }

        // If we reach here, data.choices[0] is safe
        const content = data.choices[0].message.content;

        try {
          const parsed = JSON.parse(content); // We expect OpenAI to return a JSON object
          resolve(parsed);
        } catch (jsonErr) {
          resolve({
            risk_level: "Error",
            threat_score: "N/A",
            explanation: "❌ Failed to parse OpenAI response."
          });
        }

      } catch (error) {
        resolve({
          risk_level: "Error",
          threat_score: "N/A",
          explanation: "❌ Failed to fetch threat assessment: " + error.message
        });
      }
    });
  });
}

