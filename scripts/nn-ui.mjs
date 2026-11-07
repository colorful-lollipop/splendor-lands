import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.fill('#player-name', '对战困难AI');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn:nth-child(3)');
await page.waitForTimeout(300);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell', { timeout: 20000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/nn-start.png' });

// 走 3 步拿宝石
for (let i = 0; i < 3; i += 1) {
  const tokens = page.locator('.bank-token:not(.is-empty):not([disabled])');
  const n = await tokens.count();
  for (let k = 0; k < Math.min(3, n); k += 1) {
    await tokens.nth(k).click();
    await page.waitForTimeout(90);
  }
  const takeBtn = page.locator('button:has-text("拿取")').first();
  if (await takeBtn.count()) await takeBtn.click();
  await page.waitForTimeout(2600);
}
await page.screenshot({ path: 'shots/nn-played.png' });

const log = await page.locator('.log-entry').allTextContents();
console.log('log sample:', log.slice(-8));
console.log('errors', errs.slice(0, 4));
await browser.close();
