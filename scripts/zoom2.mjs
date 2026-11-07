import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.fill('#player-name', 'zoom');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell', { timeout: 20000 });
await page.waitForTimeout(1600);
for (let t = 1; t <= 3; t += 1) {
  await page.click(`.tier-tab:nth-child(${t})`);
  await page.waitForTimeout(500);
  await page.locator('.tier-single .row-cards').screenshot({ path: `shots/cards-t${t}.png` });
}
await page.locator('.tier-single .card').first().screenshot({ path: 'shots/card-zoom.png' });
await browser.close();
