import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.click('button[aria-label="皮肤工坊"]');
await page.click('.skin-tab:has-text("卡面画风")');
await page.waitForTimeout(600);
await page.locator('.art-compare').screenshot({ path: 'shots/skin-compare-2x.png' });
await browser.close();
