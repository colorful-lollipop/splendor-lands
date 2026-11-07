import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '切换画风');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(250);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
await page.waitForTimeout(800);

for (const label of ['彩窗圣殿', '星轨绘旅', '传奇油画']) {
  await page.click('button[title="皮肤工坊"]');
  await page.click('.skin-tab:has-text("卡面画风")');
  await page.click(`.skin-card:has-text("${label}")`);
  await page.waitForTimeout(600);
  await page.click('.modal-close');
  await page.waitForTimeout(500);
  const src = await page.locator('.noble-art img').first().getAttribute('src');
  console.log(label, '->', src);
}
console.log('errors', errors);
await browser.close();