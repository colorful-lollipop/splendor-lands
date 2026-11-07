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
await page.fill('#player-name', '冲分商人');
await page.click('button:has-text("创建房间")');
await page.waitForSelector('.room-screen', { timeout: 15000 });
await page.click('.bot-add-group .btn');
await page.waitForTimeout(400);
await page.click('button:has-text("开始游戏")');
await page.waitForSelector('.game-shell', { timeout: 15000 });
await page.waitForTimeout(1200);

let bought = 0;
let reserved = 0;
let discards = 0;
let nobles = 0;
let turns = 0;

for (let step = 0; step < 400; step++) {
  if (await page.locator('.gameover-hero').count()) break;

  if (await page.locator('.discard-grid').count()) {
    const text = await page.locator('.discard-footer').innerText();
    const must = Number(text.match(/(\d+)\s*枚/)?.[1] || 1);
    for (let i = 0; i < must; i++) {
      const plus = page.locator('.discard-item:not(.is-empty) .di-stepper button').nth(1);
      if (await plus.isEnabled()) await plus.click();
      await page.waitForTimeout(90);
    }
    await page.click('.discard-footer button:has-text("确认归还")');
    discards++;
    await page.waitForTimeout(700);
    continue;
  }

  if (await page.locator('.noble-choice').count()) {
    await page.locator('.noble-choice button').first().click();
    nobles++;
    await page.waitForTimeout(700);
    continue;
  }

  const myTurn = await page.locator('.player-card.is-turn.is-you').count();
  if (!myTurn) {
    await page.waitForTimeout(450);
    continue;
  }

  const affordable = page.locator('.row-cards .card.is-affordable');
  if ((await affordable.count()) > 0) {
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
    const target = count >= 3 ? 3 : count;
    for (let i = 0; i < target; i++) {
      await tokens.nth(i).click();
      await page.waitForTimeout(80);
    }
    const take = page.locator('.action-buttons button:has-text("拿取")');
    if (await take.count()) await take.click();
  }
  turns++;
  await page.waitForTimeout(700);

  if (bought === 1 && discards === 0) await page.screenshot({ path: 'shots/play-buy.png' });
  if (nobles === 1) await page.screenshot({ path: 'shots/play-noble.png' });
}

await page.waitForTimeout(800);
const over = await page.locator('.gameover-hero').count();
if (over) await page.screenshot({ path: 'shots/gameover.png' });
console.log({ bought, discards, nobles, turns, over });
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
const log = await page.locator('.log-entry').allTextContents();
console.log('log tail:\n' + log.slice(-10).join('\n'));
await browser.close();