document.getElementById("analyzeBtn").addEventListener("click", async () => {
    const extIdOrName = document.getElementById("extInput").value.trim();
    const resultsDiv = document.getElementById("results");
  
    if (!extIdOrName) {
      resultsDiv.innerText = "Please enter a valid extension ID or name.";
      return;
    }
  
    resultsDiv.innerText = "🔍 Fetching extension metadata...";
  
    // Call background to fetch and analyze
    chrome.runtime.sendMessage({ type: "analyze-extension", input: extIdOrName }, (response) => {
      if (response && response.riskScore !== undefined) {
        resultsDiv.innerHTML = `
          <b>Risk Score:</b> ${response.riskScore}/100<br/>
          <b>Reasoning:</b><br/>${response.explanation.replace(/\n/g, "<br/>")}
        `;
      } else {
        resultsDiv.innerHTML = `<span style="color:red;">Error analyzing extension.</span>`;
      }
    });
  });
  