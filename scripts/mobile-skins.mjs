import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const errors = [];

for (const skin of ['glass', 'anime']) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await context.addInitScript((art) => {
    localStorage.setItem('splendor-skins-v1', JSON.stringify({ frame: 'gilded', art, gems: 'faceted', back: 'emerald', table: 'tavern', noble: 'oil', avatar: 'w1' }));
  }, skin);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${skin}: ${e.message}`));
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.fill('#player-name', '手机皮肤');
  await page.click('button:has-text("创建房间")');
  await page.waitForSelector('.room-screen');
  await page.click('.bot-add-group .btn');
  await page.waitForTimeout(250);
  await page.click('button:has-text("开始游戏")');
  await page.waitForSelector('.m-shell');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/mobile-game-${skin}.png` });
  const dims = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, cards: document.querySelectorAll('.m-cards .card').length }));
  console.log(skin, dims);
  await context.close();
}

console.log('errors', errors);
await browser.close();