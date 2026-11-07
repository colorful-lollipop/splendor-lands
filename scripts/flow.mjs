import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console error]', m.text());
});
page.on('pageerror', (e) => console.log('[page error]', e.message));

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.fill('#player-name', '阿尔文');
await page.waitForTimeout(300);
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen', { timeout: 15000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/room.png` });
console.log('room ok');

await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('.bot-add-group .btn');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/room-full.png` });

await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/game-start.png` });
console.log('game start ok');

// 等待轮到自己
try {
  await page.waitForSelector('.turn-banner', { timeout: 12000 });
  await page.waitForTimeout(900);
} catch {
  console.log('no turn banner within 12s');
}
await page.screenshot({ path: `${OUT}/game-my-turn.png` });
console.log('my turn ok');

// 打开卡牌详情（单行牌桌，先切到二级再点第一张）
await page.click('.tier-tab:nth-child(2)');
await page.waitForTimeout(400);
const card = page.locator('.tier-single .row-cards .card').first();
await card.click();
await page.waitForSelector('.modal', { timeout: 5000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/card-detail.png` });
await page.click('.modal-close');
await page.waitForTimeout(300);

// 皮肤面板
await page.click('button[title="皮肤工坊"]');
await page.waitForSelector('.modal', { timeout: 5000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/skins.png` });
await page.click('.skin-tab:has-text("宝石样式")');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/skins-gems.png` });
await page.click('.modal-close');

await browser.close();
console.log('done');