import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];
const base = 'http://localhost:3001';

const a = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const pageA = await a.newPage();
pageA.on('pageerror', (e) => errors.push('A: ' + e.message));
await pageA.goto(base, { waitUntil: 'networkidle' });
await pageA.fill('#player-name', '房主A');
await pageA.click('button:has-text("创建房间")');
await pageA.waitForSelector('.room-screen');
const code = (await pageA.locator('.rc-code').innerText()).trim();
console.log('room code', code);

const b = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const pageB = await b.newPage();
pageB.on('pageerror', (e) => errors.push('B: ' + e.message));
await pageB.goto(base, { waitUntil: 'networkidle' });
await pageB.waitForTimeout(800);
const beforePublic = await pageB.locator('.room-row').allTextContents();
console.log('lobby before public:', beforePublic.length, beforePublic.some((t) => t.includes(code)));

await pageA.click('.visibility-btn');
await pageA.waitForTimeout(700);
const afterPublic = await pageB.locator('.room-row').allTextContents();
console.log('lobby after public:', afterPublic.length, afterPublic.some((t) => t.includes(code)));
await pageB.screenshot({ path: 'shots/lobby-public-room.png' });

await pageA.click('.visibility-btn');
await pageA.waitForTimeout(700);
const afterPrivate = await pageB.locator('.room-row').allTextContents();
console.log('lobby after private:', afterPrivate.length, afterPrivate.some((t) => t.includes(code)));

// 局域网 http 非安全上下文下的复制回退
const c = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const pageC = await c.newPage();
pageC.on('pageerror', (e) => errors.push('C: ' + e.message));
await pageC.goto('http://192.168.1.221:3001', { waitUntil: 'networkidle' });
const secure = await pageC.evaluate(() => window.isSecureContext);
await pageC.fill('#player-name', '复制测试');
await pageC.click('button:has-text("创建房间")');
await pageC.waitForSelector('.room-screen');
await pageC.click('.room-code-block');
await pageC.waitForSelector('.toast');
const toast = await pageC.locator('.toast').last().innerText();
console.log('secureContext', secure, 'toast', toast);

console.log('errors', errors);
await browser.close();