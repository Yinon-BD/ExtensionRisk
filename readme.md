# 🔐 Chrome Extension Risk Assessor

## 📘 Overview

This project is a Chrome extension that analyzes other Chrome extensions for potential security risks.  
Users can input the ID of a Chrome extension, after which an external tool downloads the `.crx` file. This tool extracts metadata, and uses the OpenAI API to provide a threat score and risk analysis.

---

## ✨ Features

- Input Chrome Extension ID
- Create a direct link to the Chrome Web Store page of the extension
- Extract and parse `manifest.json` and additional metadata:
  - `name`, `version`, `description`, `permissions`, `rating`, and number of users
- Use OpenAI API for:
  - Risk score generation
  - Natural language explanation of risks
- Display metadata and risk assessment results in the extension popup UI

---

## 🧱 Architecture

### Frontend
- Popup interface to:
  - Enter extension ID
  - Upload CRX files
  - Display metadata and results
  - Assign an OpenAI API key

### Background Script
- Handles storage of metadata and OpenAI key
- Communicates with the server for threat analysis
- Sends user-provided data to OpenAI and receives the response

### Server
- Uses Puppeteer to scrape the Chrome Web Store extension page
- Retrieves metadata not included in `manifest.json`, such as:
  - Rating
  - User count

### CRX Downloader
- An open-source Chrome extension: [CRX Extractor/Downloader](https://chromewebstore.google.com/detail/crx-extractordownloader/ajkhmmldknmfjnmeedkbkkojgobmljda)
- Currently used manually by the user to download `.crx` files
- Future plans include integrating CRX download functionality directly into this project

---

## 🧠 Risk Assessment Methodology

### Metadata Analysis
The following fields are extracted and analyzed:
- `name`
- `description`
- `permissions`
- `host_permissions`
- `content_scripts`
- `version`
- `manifest_version`
- `average_rating`
- `user_count`

### Risk Detection Approach
- Metadata is formatted into a structured prompt
- Sent to OpenAI’s GPT-4o-mini model
- Model evaluates:
  - Suspicious permissions (e.g., `<all_urls>`, `webRequest`, `tabs`)
  - Dangerous host access
  - Vague or misleading descriptions
  - Excessive or unjustified requested capabilities

### Prompt Template
> "Given the following metadata from a Chrome extension, provide a **risk score from 0 to 10**, and explain the reasoning. Focus on any suspicious permissions, overly broad host access, or other red flags."

### Output Format
- **🛡️ Risk Level**: Low / Medium / High
- **📊 Threat Score**: 0–10
- **💬 Explanation**: One-paragraph natural language summary highlighting the main risk factors

---

## ⚠️ Limitations

- Risk score depends on metadata alone — actual source code is not analyzed
- User cannot use the extension without his own OpenAI API key
- Quality and consistency of assessment depends on metadata availability
- Real-time behavioral monitoring is not included

---

## 🚀 Future Improvements

- Integrate CRX download and extraction directly in the extension
- Add model fine-tuning for more accurate scoring
- Enhance UX and get results with one click

---

## 🧰 Tech Stack & Dependencies

- **Chrome Extension APIs** (Manifest V3)
- **Node.js + Express** (backend server)
- **Puppeteer** (extension metadata scraper)
- **OpenAI API** (threat evaluation using GPT-4)
- **CRX Extractor/Downloader** (manual CRX downloads)

---

## 👥 Authors & Acknowledgements

- Developed by: Yinon Ben David
- CRX extraction thanks to: [CRX Extractor/Downloader](https://github.com/tonystark93/crx-download)
- Risk scoring powered by OpenAI

---

## 📦 Installation Instructions

1. Clone the repository
2. Install server dependencies:
   ```bash
   cd extension-scraper
   npm install express puppeteer cors
   ```
3. Start the backend server:
    ```bash
    node server.js
    ```
4. Load the extension in Chrome:
    - Go to (chrome://extensions/)
    - Enable "Developer mode"
    - Click "Load unpacked"
    - Select the `ExtensionRiskAssessment` directory
5. Add your OpenAI API key in settings
6. Input a Chrome Extension ID
7. Click on the given link to go to the extension's web page
8. Open CRX Extractor/Downloader extension and click `Download as CRX`
9. Open ExtensionRiskAssessment extension and upload the `.crx` file
10. View metadata and security risk analysis
