import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sizes = [
  [1366, 768, 'v-1366'],
  [1024, 640, 'v-1024'],
  [1920, 1080, 'v-1920'],
  [800, 600, 'v-800'],
];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

for (const [w, h, tag] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/${tag}-lobby.png` });
  await page.fill('#player-name', '尺寸测试');
  await page.click('button:has-text("创建房间")');
  await page.waitForSelector('.room-screen');
  await page.click('button:has-text("添加电脑")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("开始游戏")');
  await page.waitForSelector('.game-shell');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/${tag}-game.png` });
  const portraitHint = await page.locator('.rotate-hint').count();
  console.log(tag, 'rotateHint', portraitHint, 'scale', await page.evaluate(() => {
    const el = document.querySelector('.game-scale-wrap');
    return el ? el.style.transform : 'none';
  }));
  await ctx.close();
}
await browser.close();