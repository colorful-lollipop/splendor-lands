import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];

async function openPage(width, height, mobile = false) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  return { context, page };
}

{
  const { context, page } = await openPage(1600, 1000);
  console.log('desktop hero cards', await page.locator('.hero-card:visible').count());
  await page.click('button[aria-label="皮肤工坊"]');
  await page.click('.skin-tab:has-text("卡面画风")');
  await page.click('.skin-card:has-text("星轨绘旅")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/anime-skins.png' });
  await page.click('.modal-close');
  await page.screenshot({ path: 'shots/anime-landing.png' });
  await page.click('button[aria-label="宝石图鉴"]');
  await page.waitForSelector('.collection-grid');
  console.log('collection cards', await page.locator('.collection-card').count(), 'owned', await page.locator('.collection-card.is-owned').count());
  await page.screenshot({ path: 'shots/collection-empty.png' });
  await context.close();
}

for (const [width, height, mobile] of [[1024, 700, false], [844, 390, true]]) {
  const { context, page } = await openPage(width, height, mobile);
  const visible = await page.locator('.hero-card:visible').count();
  const dimensions = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, innerHeight }));
  console.log(`${width}x${height}`, { visible, ...dimensions });
  if (visible !== 3 || dimensions.scrollHeight !== height) throw new Error('首页卡牌或单页布局回归失败');
  await page.screenshot({ path: `shots/anime-landing-${width}.png` });
  await context.close();
}

console.log('errors', errors);
await browser.close();
