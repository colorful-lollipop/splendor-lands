import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const errors = [];

for (const [width, height] of [[866, 700], [900, 600], [1280, 720], [1366, 768]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${width}x${height}: ${e.message}`));
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const dims = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, cards: document.querySelectorAll('.hero-card').length }));
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.hero-card')].map((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
  console.log(`${width}x${height}`, dims, boxes);
  await page.screenshot({ path: `shots/landing-size-${width}.png` });
  await context.close();
}

console.log('errors', errors);
await browser.close();