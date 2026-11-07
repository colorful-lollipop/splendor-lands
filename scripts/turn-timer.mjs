import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '计时测试');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.turn-setting-options button:has-text("30s")');
await page.waitForTimeout(300);
const active = await page.locator('.turn-setting-options button.is-active').innerText();
console.log('turn setting active:', active);

await page.click('.bot-add-group .btn');
await page.waitForTimeout(250);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
for (let i = 0; i < 40 && !(await page.locator('.player-card.is-turn.is-you').count()); i++) await page.waitForTimeout(400);
if (!(await page.locator('.player-card.is-turn.is-you').count())) throw new Error('没有等到自己的回合');

await page.waitForTimeout(26000);
const clock = await page.locator('.turn-timer').innerText().catch(() => '');
const danger = await page.locator('.turn-timer.is-danger').count();
console.log('clock at 26s:', JSON.stringify(clock), 'danger class:', danger);
await page.screenshot({ path: 'shots/turn-timer-danger.png' });

await page.waitForTimeout(6000);
const logs = await page.locator('.log-entry').allTextContents();
const skipped = logs.some((t) => t.includes('跳过本回合'));
const stillMe = await page.locator('.player-card.is-turn.is-you').count();
console.log('timeout skipped:', skipped, 'still my turn:', Boolean(stillMe));
await page.screenshot({ path: 'shots/turn-timer-skipped.png' });
console.log('errors', errors);
await browser.close();