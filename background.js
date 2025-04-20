chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "analyze-extension") {
      const extensionId = message.input;
  
      // Placeholder: simulate data + AI result
      const mockMetadata = {
        name: "Example Extension",
        permissions: ["tabs", "storage", "cookies"],
        users: 10000,
        reviews: "Mixed",
        developer: "Unknown Publisher"
      };
  
      const prompt = `
  Analyze the following Chrome extension metadata for security risks:
  
  Name: ${mockMetadata.name}
  Permissions: ${mockMetadata.permissions.join(', ')}
  Users: ${mockMetadata.users}
  Developer: ${mockMetadata.developer}
  Reviews: ${mockMetadata.reviews}
  
  Give a risk score (0-100) and explain why.
  `;
  
      fetch("https://api.openai.com/v1/chat/completions", {
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
      })
      .then(res => res.json())
      .then(data => {
        const aiReply = data.choices[0].message.content;
        const match = aiReply.match(/score[:\s]*([0-9]{1,3})/i);
        const score = match ? parseInt(match[1]) : "N/A";
  
        sendResponse({
          riskScore: score,
          explanation: aiReply
        });
      })
      .catch(err => {
        console.error("AI call failed:", err);
        sendResponse({ error: true });
      });
  
      // required for async response
      return true;
    }
  });
  