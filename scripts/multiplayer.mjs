import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = process.argv[2] || 'http://localhost:3001';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctxA = await browser.newContext({ viewport: { width: 1500, height: 940 } });
const ctxB = await browser.newContext({ viewport: { width: 1500, height: 940 } });
const a = await ctxA.newPage();
const b = await ctxB.newPage();
const errors = [];
for (const [who, p] of [['A', a], ['B', b]]) {
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${who}: ${m.text()}`);
  });
  p.on('pageerror', (e) => errors.push(`${who} PAGEERROR: ${e.message}`));
}

await a.goto(base, { waitUntil: 'networkidle' });
await a.fill('#player-name', '房主阿尔文');
await a.click('button:has-text("创建房间")');
await a.waitForSelector('.room-screen');
const code = (await a.locator('.rc-code').innerText()).trim();
console.log('room code', code);

await b.goto(`${base}?room=${code}`, { waitUntil: 'networkidle' });
await b.fill('#player-name', '客人贝拉');
await b.waitForTimeout(300);
await b.click('button:has-text("加入")');
await b.waitForSelector('.room-screen', { timeout: 10000 });
console.log('B joined');

// A 屏幕上应出现 B
await a.waitForFunction(() => document.querySelectorAll('.seat.is-filled').length >= 2, { timeout: 8000 });
await a.screenshot({ path: 'shots/room-two.png' });

await a.click('button:has-text("开始游戏")');
await a.waitForSelector('.game-shell');
await b.waitForSelector('.game-shell');
console.log('game started');

await a.waitForTimeout(1500);
await b.screenshot({ path: 'shots/game-b.png' });

// B 刷新页面，应自动回到对局
await b.reload({ waitUntil: 'networkidle' });
await b.waitForSelector('.game-shell', { timeout: 12000 });
console.log('B reconnected after reload');
const nameB = await b.locator('.self-name').innerText();
console.log('B self name:', nameB);

// B 发送聊天
await b.fill('.chat-input-row input', '大家好，我是贝拉');
await b.press('.chat-input-row input', 'Enter');
await b.waitForTimeout(600);
const chatA = await a.locator('.chat-list').innerText();
console.log('A sees chat:', chatA.includes('大家好'));

await a.screenshot({ path: 'shots/game-a.png' });
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();