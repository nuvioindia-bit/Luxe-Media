import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
await page.setContent(`
  <script type="module">
    import { GoogleGenAI } from "https://esm.sh/@google/genai";
    try {
      new GoogleGenAI({ apiKey: '' });
      console.log('Success with empty string');
    } catch(e) {
      console.error(e.message);
    }
  </script>
`);
await new Promise(r => setTimeout(r, 2000));
await browser.close();
