import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.fill('#player-name', '测试商人');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen', { timeout: 15000 });
await page.click('.bot-add-group .btn');
await page.waitForTimeout(400);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell', { timeout: 15000 });
await page.waitForTimeout(1500);

let moves = 0;
let bought = 0;
let discards = 0;
for (let step = 0; step < 80 && moves < 20; step++) {
  // 处理弃宝石
  if (await page.locator('.discard-grid').count()) {
    const must = Number((await page.locator('.discard-footer').innerText()).match(/(\d+)\s*枚/)?.[1] || 1);
    for (let i = 0; i < must; i++) {
      const plus = page.locator('.discard-item:not(.is-empty) .di-stepper button').nth(1);
      await plus.click();
      await page.waitForTimeout(120);
    }
    await page.click('.discard-footer button:has-text("确认归还")');
    discards++;
    await page.waitForTimeout(900);
    continue;
  }

  // 处理贵族选择
  if (await page.locator('.noble-choice').count()) {
    await page.locator('.noble-choice button').first().click();
    await page.waitForTimeout(900);
    continue;
  }

  const myTurn = await page.locator('.player-card.is-turn.is-you').count();
  if (!myTurn) {
    await page.waitForTimeout(600);
    continue;
  }

  const affordable = page.locator('.row-cards .card.is-affordable');
  const n = await affordable.count();
  if (n > 0) {
    await affordable.first().click();
    await page.waitForSelector('.modal', { timeout: 4000 });
    const buy = page.locator('.modal button:has-text("购入卡牌")');
    if (await buy.isEnabled()) {
      await buy.click();
      bought++;
    } else {
      await page.click('.modal-close');
    }
  } else {
    const tokens = page.locator('.bank-token:not(.is-empty):not([disabled])');
    const count = await tokens.count();
    const target = count >= 3 ? 3 : count >= 2 ? 2 : 1;
    for (let i = 0; i < target; i++) {
      await tokens.nth(i).click();
      await page.waitForTimeout(120);
    }
    const take = page.locator('.action-buttons button:has-text("拿取")');
    if (await take.count()) await take.click();
  }
  moves++;
  await page.waitForTimeout(900);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/game-played.png' });

// 实际购入的发展卡应立即点亮永久图鉴，并在刷新后保留。
let collected = 0;
if (bought > 0) {
  await page.click('button[aria-label="宝石图鉴"]');
  await page.waitForSelector('.collection-grid');
  collected = await page.locator('.collection-card.is-owned').count();
  if (collected < 1) throw new Error('购买后图鉴没有收录卡牌');
  await page.screenshot({ path: 'shots/collection.png' });
  await page.click('.collection-grid .collection-card.is-owned .card');
  await page.waitForSelector('.collection-preview');
  await page.screenshot({ path: 'shots/collection-detail.png' });
  await page.click('.modal-close');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.game-shell', { timeout: 15000 });
  await page.click('button[aria-label="宝石图鉴"]');
  await page.waitForSelector('.collection-grid');
  const afterReload = await page.locator('.collection-card.is-owned').count();
  if (afterReload < collected) throw new Error(`图鉴刷新后丢失收藏：${collected} -> ${afterReload}`);
  await page.click('.modal-close');
}
console.log('moves', moves, 'bought', bought, 'discards', discards, 'collected', collected);
console.log('errors:', errors.length ? errors : 'none');
const log = await page.locator('.log-entry').allTextContents();
console.log('log tail:', log.slice(-8).join('\n'));
await browser.close();