import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];

async function open(width, height, mobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return { context, page };
}

{
  const { context, page } = await open(1600, 1000);
  await page.click('button[aria-label="皮肤工坊"]');
  await page.click('.skin-tab:has-text("卡面画风")');
  await page.waitForTimeout(700);
  await page.locator('.art-compare').screenshot({ path: 'shots/skin-compare.png' });
  console.log('compare names:', await page.locator('.art-compare-copy span').allTextContents());
  for (const skin of ['legend', 'glass', 'anime']) {
    await page.click(`.skin-card:has-text("${skin === 'legend' ? '传奇油画' : skin === 'glass' ? '彩窗圣殿' : '星轨绘旅'}")`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `shots/skin-modal-${skin}.png` });
  }
  await context.close();
}

for (const [width, height, mobile] of [[1600, 1000, false], [1024, 700, false], [844, 390, true]]) {
  const { context, page } = await open(width, height, mobile);
  const dims = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, visible: document.querySelectorAll('.hero-card').length }));
  console.log(`${width}x${height}`, dims);
  if (dims.sh !== height) throw new Error('页面出现滚动');
  await page.screenshot({ path: `shots/landing-${width}.png` });
  await context.close();
}

console.log('errors', errors);
await browser.close();