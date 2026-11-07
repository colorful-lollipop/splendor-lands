import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const [w, h] of [[1366, 768], [1920, 1080], [1024, 700]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/vp-${w}-lobby.png` });
  await page.fill('#player-name', '视口');
  await page.click('button:has-text("创建房间")');
  await page.waitForSelector('.room-screen');
  await page.click('button:has-text("添加电脑")');
  await page.waitForTimeout(200);
  await page.click('button:has-text("开始游戏")');
  await page.waitForTimeout(1600);
  const hasDesktop = await page.locator('.game-shell').count();
  const hasMobile = await page.locator('.m-shell').count();
  const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
  console.log(w, h, 'desktop', hasDesktop, 'mobile', hasMobile, 'doc', scroll, 'errors', errs.length);
  await page.screenshot({ path: `shots/vp-${w}-game.png` });
  await page.close();
}
await browser.close();
