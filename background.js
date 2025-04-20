const USE_DUMMY_RESPONSE = true; // Set to false to use real OpenAI API

// Helper to validate if the input is a proper extension ID (32 lowercase letters)
function isValidExtensionId(input) {
    return /^[a-p]{32}$/.test(input);
}
  
// Fetch metadata from CRXplore
async function fetchExtensionMetadata(extensionId) {
    const response = await fetch(`https://corsproxy.io/?https://api.crxplore.dev/extensions/${extensionId}`);
    if (!response.ok) throw new Error("Extension not found or blocked");

    const data = await response.json();

    return {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        users: data.users,
        updated: data.updated,
        developer: data.developer,
        contentScripts: data.content_scripts,
        homepage: data.homepage_url,
        version: data.version
    };
}
  
  // Format metadata as a prompt for OpenAI
  function buildPrompt(metadata) {
    return `
  Analyze the following Chrome extension metadata for potential security risks.
  
  Name: ${metadata.name}
  Version: ${metadata.version}
  Developer: ${metadata.developer}
  Permissions: ${metadata.permissions?.join(", ") || "None"}
  Users: ${metadata.users}
  Updated: ${metadata.updated}
  Description: ${metadata.description}
  Homepage: ${metadata.homepage}
  
  Based on this information, give a risk score (0-100) and explain why.
  `;
  }
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "analyze-extension") {
      const extensionId = message.input.trim();
  
      if (!isValidExtensionId(extensionId)) {
        sendResponse({ error: true, message: "Please enter a valid 32-character extension ID." });
        return;
      }

      
  
      // Fetch metadata and send to OpenAI
      fetchExtensionMetadata(extensionId)
        .then(async (metadata) => {
          const prompt = buildPrompt(metadata);
          console.log("Prompt sent to OpenAI:\n", prompt);

          if (USE_DUMMY_RESPONSE) {
            const dummyReply = `
              Risk Score: 73
          
              This extension requests access to all tabs and uses content scripts, which may be risky.
              It is published by an unknown developer and hasn't been updated in a long time.
            `;
          
            sendResponse({
              riskScore: 73,
              explanation: dummyReply
            });
            return true;
          }
  
          const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer YOUR_OPENAI_KEY"
            },
            body: JSON.stringify({
              model: "gpt-4",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3
            })
          });
  
          const data = await aiResponse.json();
          const aiText = data.choices?.[0]?.message?.content || "AI did not return a valid response";
  
          const match = aiText.match(/score[:\s]*([0-9]{1,3})/i);
          const score = match ? parseInt(match[1]) : "N/A";
  
          sendResponse({
            riskScore: score,
            explanation: aiText
          });
        })
        .catch((err) => {
          console.error("Error during analysis:", err);
          sendResponse({ error: true, message: "Failed to fetch or analyze extension data." });
        });
  
      // Required for async `sendResponse`
      return true;
    }
  });
  