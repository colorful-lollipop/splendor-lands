import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/m-lobby.png' });

await page.fill('#player-name', '手机商人');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen', { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/m-room.png' });

await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.m-shell', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/m-game.png' });

const box = await page.locator('.m-cards').boundingBox();
const tabs = await page.locator('.m-tabs').boundingBox();
const foot = await page.locator('.m-foot').boundingBox();
console.log('tabs', tabs, 'cards', box, 'foot', foot);
const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
console.log('rows', box, 'foot', foot, 'doc', scroll);

// 点卡牌看详情
const card = page.locator('.m-cards .card').nth(2);
await card.tap();
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/m-card.png' });
const hasModal = await page.locator('.modal').count();
console.log('modal', hasModal);
if (hasModal) {
  const mb = await page.locator('.modal').boundingBox();
  console.log('modal box', mb);
  await page.locator('.modal-close').click();
  await page.waitForTimeout(300);
}

// 选宝石
const tokens = page.locator('.m-token:not(.is-empty):not([disabled])');
for (let i = 0; i < 3; i++) {
  await tokens.nth(i).tap();
  await page.waitForTimeout(120);
}
await page.screenshot({ path: 'shots/m-gems.png' });
await page.click('.m-take-btn');
await page.waitForTimeout(800);

// 打开抽屜
await page.locator('.m-btn').nth(2).tap();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/m-menu.png' });

console.log('errors', errors.slice(0, 6));
await browser.close();