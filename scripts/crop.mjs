import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const el = page.locator('.game-shell');
await el.screenshot({ path: 'shots/crop-check.png' }).catch(async () => {
  await page.screenshot({ path: 'shots/crop-check.png' });
});
await browser.close();
