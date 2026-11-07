import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 打开皮肤
await page.click('.landing-nav .icon-btn[title="皮肤工坊"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/skin-frame.png' });

// 卡面 tab
await page.click('.skin-tab:has-text("卡面")');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/skin-art-legend.png' });
await page.click('.skin-card:has-text("彩窗圣殿")');
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/skin-art-glass.png' });
await page.locator('.modal-close').click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/lobby-glass.png' });

// 贵族 tab
await page.click('.landing-nav .icon-btn[title="皮肤工坊"]');
await page.waitForTimeout(300);
await page.click('.skin-tab:has-text("贵族")');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/skin-noble-glass.png' });
await page.locator('.modal-close').click();

// 开局
await page.fill('#player-name', '彩窗商人');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(200);
await page.click('.bot-add-group .btn');
await page.waitForTimeout(200);
await page.click('.bot-add-group .btn');
await page.waitForTimeout(300);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/game-glass.png' });

console.log('errors', errors.slice(0, 5));
await browser.close();