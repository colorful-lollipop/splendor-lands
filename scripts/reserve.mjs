import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '预订测试');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
await page.waitForTimeout(1500);

// 等自己的回合
for (let i = 0; i < 20; i++) {
  if (await page.locator('.player-card.is-turn.is-you').count()) break;
  await page.waitForTimeout(500);
}
// 点击牌堆盲抽预订
await page.locator('.deck-pile').first().click();
await page.waitForSelector('.modal');
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/deck-detail.png' });
await page.click('.modal button:has-text("预订")');
await page.waitForTimeout(800);
console.log('reserved slot count', await page.locator('.self-reserved .reserved-slot .card-back').count());
await page.screenshot({ path: 'shots/reserved.png' });

// 等下一回合，点击保留卡
for (let i = 0; i < 20; i++) {
  if (await page.locator('.player-card.is-turn.is-you').count()) break;
  await page.waitForTimeout(500);
}
await page.locator('.self-reserved .reserved-slot').first().click();
await page.waitForTimeout(500);
const hasModal = await page.locator('.modal').count();
if (hasModal) {
  await page.screenshot({ path: 'shots/reserved-detail.png' });
  console.log('reserved detail:', await page.locator('.modal-title').innerText());
  await page.click('.modal-close');
}
console.log('gold', await page.locator('.self-mid .wallet-pill').last().innerText());
console.log('errors', errors);
await browser.close();