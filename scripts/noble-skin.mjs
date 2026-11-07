import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.click('button[aria-label="皮肤工坊"]');
await page.click('.skin-tab:has-text("贵族")');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/noble-tab.png' });
const names = await page.locator('.skin-card .skin-name').allTextContents();
console.log('noble options:', names);

const before = await page.locator('.noble-preview img').first().getAttribute('src');
await page.click('.skin-card:has-text("星轨王庭")');
await page.waitForTimeout(600);
const after = await page.locator('.noble-preview img').first().getAttribute('src');
console.log('before:', before, 'after:', after);
await page.screenshot({ path: 'shots/noble-tab-anime.png' });
await page.click('.modal-close');

// 牌桌上的贵族
await page.fill('#player-name', '贵族测试');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(250);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/noble-board-anime.png' });
const srcs = await page.locator('.noble-art img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
console.log('board nobles:', srcs);
console.log('errors', errors);
await browser.close();