import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '皮肤测试');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(250);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
await page.waitForTimeout(800);

for (const [skin, label] of [['legend', '传奇油画'], ['glass', '彩窗圣殿'], ['anime', '星轨绘旅']]) {
  if (skin !== 'legend') {
    await page.click('button[title="皮肤工坊"]');
    await page.click('.skin-tab:has-text("卡面画风")');
    await page.click(`.skin-card:has-text("${label}")`);
    await page.waitForTimeout(500);
    await page.click('.modal-close');
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `shots/game-${skin}.png` });
  await page.click('button[aria-label="宝石图鉴"]');
  await page.waitForSelector('.collection-grid');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/collection-${skin}.png` });
  if (skin === 'legend') {
    const first = page.locator('.collection-card .card').first();
    await first.click({ force: true }).catch(() => {});
  }
  await page.click('.modal-close');
}

console.log('errors', errors);
await browser.close();