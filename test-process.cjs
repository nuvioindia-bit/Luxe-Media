const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  // Navigate to a page that imports gemini.ts. Oh wait, App.tsx imports all pages!
  // If App.tsx imports all pages, it should crash immediately on load if it throws during module evaluation.
  // But my previous test SHOWED that the Auth page rendered successfully!
  // Why did it not crash? Let's check again!
  await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
