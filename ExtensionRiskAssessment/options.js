document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const status = document.getElementById('status');
  
    // Load saved key
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
      if (result.openaiApiKey) {
        apiKeyInput.value = result.openaiApiKey;
      }
    });
  
    // Save button click
    document.getElementById('saveBtn').addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (!key.startsWith('sk-')) {
        status.textContent = "Invalid API key format.";
        status.style.color = 'red';
        return;
      }
  
      chrome.storage.sync.set({ openaiApiKey: key }, () => {
        status.textContent = "API key saved successfully.";
        status.style.color = 'green';
      });
    });
});

document.getElementById('deleteBtn').addEventListener('click', () => {
    chrome.storage.sync.remove('openaiApiKey', () => {
      document.getElementById('apiKey').value = '';
      document.getElementById('status').textContent = 'API key deleted.';
      document.getElementById('status').style.color = 'orange';
    });
  });
  
  