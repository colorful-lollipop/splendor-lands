import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '预览商人');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/game-3p.png' });

const me = await page.evaluate(() => window.__splendorDev.getState().game.me.id);
await page.evaluate((me) => {
  window.__splendorDev.devPatchGame({
    phase: 'noble',
    pending: { type: 'noble', playerId: me, options: ['catherine', 'suleiman', 'charles'] },
  });
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/noble-choice.png' });
await page.evaluate(() => window.__splendorDev.devPatchGame({ phase: 'action', pending: null }));
await page.waitForTimeout(300);

// 贵族详情
await page.locator('.nobles-row .noble').first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/noble-detail.png' });
await page.click('.modal-close');
await page.waitForTimeout(300);

// 弃宝石
await page.evaluate(() => {
  window.__splendorDev.devPatchGame({ phase: 'discard', pending: { type: 'discard', playerId: window.__splendorDev.getState().game.me.id, mustReturn: 2 } });
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/discard.png' });

await browser.close();
console.log('preview done');