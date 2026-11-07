import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '房主A');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen');
await page.screenshot({ path: 'shots/room-private.png' });
await page.click('.visibility-btn');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/room-public.png' });
await browser.close();
