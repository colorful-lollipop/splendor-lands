import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://splendor.zulogic.cn/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function smoke(width, height, mobile, label) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  const hero = await page.locator('.hero-card:visible').count();
  const doc = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
  console.log(label, 'hero', hero, 'doc', doc);

  await page.fill('#player-name', `线上验收${label}`);
  await page.click('button:has-text("创建房间")');
  await page.waitForSelector('.room-screen');
  await page.click('.bot-add-group .btn');
  await page.waitForTimeout(300);
  await page.click('button:has-text("开始游戏")');
  await page.waitForSelector('.game-shell, .m-shell, .game-root');
  await page.waitForTimeout(1200);

  // 切换到动漫皮肤，确认线上静态资源可正常加载。
  if (!mobile) {
    await page.click('button[title="皮肤工坊"]');
    await page.click('.skin-tab:has-text("卡面画风")');
    await page.click('.skin-card:has-text("星轨绘旅")');
    await page.waitForTimeout(1200);
    await page.click('.modal-close');
    await page.waitForTimeout(800);
  }

  const cards = await page.locator('.card').count();
  console.log(label, 'cards', cards, 'errors', errors.length, 'failed', failed.length);
  if (hero !== 3) errors.push(`hero cards ${hero}`);
  if (failed.length) console.log(failed.slice(0, 10));
  await page.screenshot({ path: `shots/prod-${label}.png` });
  await context.close();
  return { errors, failed, doc };
}

const desktop = await smoke(1600, 1000, false, 'desktop');
const mobile = await smoke(844, 390, true, 'mobile');
await browser.close();
if (desktop.errors.length || mobile.errors.length || desktop.failed.length || mobile.failed.length) {
  console.error('production smoke failed', desktop.errors, mobile.errors);
  process.exit(1);
}
console.log('production smoke ok');