import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const [w, h] of [[1600, 1000], [1280, 720], [1024, 700]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const box = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) }; };
    return {
      container: box('.hero-cards'),
      gem: box('.hero-gem'),
      cards: [...document.querySelectorAll('.hero-card')].map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), r: Math.round(r.right), b: Math.round(r.bottom) }; }),
      features: box('.hero-features'),
      noble: box('.hero-noble'),
    };
  });
  console.log(w + 'x' + h, JSON.stringify(info));
  await context.close();
}
await browser.close();