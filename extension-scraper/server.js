const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/extension/:id", async (req, res) => {
  const { id } = req.params;
  const url = `https://chrome.google.com/webstore/detail/${id}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.198 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Extract users
      let users = null;
      const userMatch = bodyText.match(/([\d,\.]+)\s+users/i);
      if (userMatch) {
        users = parseInt(userMatch[1].replace(/[^\d]/g, ""));
      }

      // Extract rating
      let rating = null;
      const ratingMatch = bodyText.match(/(\d\.\d)\s*★?\s*out of 5/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }

      return { users, rating };
    });

    await browser.close();
    res.json(data);
  } catch (err) {
    console.error("❌ Error scraping extension stats:", err);
    if (browser) await browser.close();
    res.status(500).json({ error: "Scraping failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Scraper API running at http://localhost:${PORT}`);
});
