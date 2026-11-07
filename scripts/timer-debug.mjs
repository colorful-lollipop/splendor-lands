import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on('console', (m) => console.log('console', m.type(), m.text()));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '计时调试');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.click('.turn-setting-options button:has-text("30s")');
await page.click('.bot-add-group .btn');
await page.waitForTimeout(250);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell');
for (let i = 0; i < 40 && !(await page.locator('.player-card.is-turn.is-you').count()); i++) await page.waitForTimeout(400);
for (let i = 0; i < 5; i++) {
  const info = await page.evaluate(() => ({
    top: document.querySelector('.topbar-center')?.innerText,
    timers: [...document.querySelectorAll('[class*=turn-timer]')].map((e) => e.className + '|' + e.textContent),
    round: document.querySelector('.round-pill')?.innerText,
  }));
  console.log(i, JSON.stringify(info));
  await page.waitForTimeout(1000);
}
await browser.close();