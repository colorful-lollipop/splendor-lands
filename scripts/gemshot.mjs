import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.click('.landing-nav .icon-btn[title="皮肤工坊"]');
await page.waitForTimeout(300);
await page.click('.skin-tab:has-text("宝石")');
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/gems-faceted.png' });
for (const [name, label] of [['coin', '古国金币'], ['crystal', '原始晶簇'], ['rune', '秘法符文']]) {
  await page.click(`.skin-card:has-text("${label}")`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/gems-${name}.png` });
}
await browser.close();