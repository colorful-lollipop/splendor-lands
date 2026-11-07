import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

for (const [skin, label] of [['legend', '传奇油画'], ['glass', '彩窗圣殿'], ['anime', '星轨绘旅']]) {
  await page.click('button[aria-label="皮肤工坊"]');
  await page.click('.skin-tab:has-text("卡面画风")');
  await page.click(`.skin-card:has-text("${label}")`);
  await page.waitForTimeout(500);
  await page.click('.modal-close');
  await page.waitForTimeout(600);
  await page.locator('.hero-cards').screenshot({ path: `shots/hero-${skin}.png` });
  console.log(skin, await page.locator('.hero-card .card-name').allTextContents());
}
console.log('errors', errors);
await browser.close();