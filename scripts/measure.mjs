import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const [w, h] of [[1600, 1000], [1920, 1080], [1366, 768]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.fill('#player-name', 'measure');
  await page.click('button:has-text("创建房间")');
  await page.waitForSelector('.room-screen');
  await page.click('.bot-add-group .btn');
  await page.waitForTimeout(250);
  await page.click('button:has-text("开始游戏")');
  await page.waitForSelector('.game-shell', { timeout: 20000 });
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const ts = document.querySelector('.tier-single');
    const card = document.querySelector('.tier-single .card');
    const cs = getComputedStyle(card);
    const r = (el) => (el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null);
    return {
      tierSingle: r(ts),
      card: r(card),
      cw: cs.getPropertyValue('--cw').trim(),
      ch: cs.getPropertyValue('--ch').trim(),
      art: r(card.querySelector('.card-art')),
      name: r(card.querySelector('.card-name')),
      cost: r(card.querySelector('.card-cost')),
      scale: getComputedStyle(document.querySelector('.game-scale-wrap')).transform,
    };
  });
  console.log(w, h, JSON.stringify(info));
  await page.close();
}
await browser.close();
