import { chromium } from 'playwright-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function verifyReservedPurchase(width, height, mobile) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.fill('#player-name', mobile ? '手机保留购买' : '桌面保留购买');
  await page.click('button:has-text("创建房间")');
  await page.waitForSelector('.room-screen');
  await page.click('.bot-add-group .btn');
  await page.waitForTimeout(250);
  await page.click('button:has-text("开始游戏")');
  await page.waitForSelector('.game-shell, .m-shell');

  const myTurnSelector = '.player-card.is-turn.is-you, .m-turn.is-you';
  for (let i = 0; i < 30 && !(await page.locator(myTurnSelector).count()); i++) await page.waitForTimeout(400);
  if (!(await page.locator(myTurnSelector).count())) throw new Error('没有等到自己的首个回合');

  // 保留一张一级明牌。
  await page.locator('.row-cards .card, .m-cards .card').first().click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button:has-text("预订")').click();
  await page.waitForSelector('.reserved-slot.has-card .card, .m-reserved .card');

  let bought = false;
  for (let turn = 0; turn < 16 && !bought; turn++) {
    for (let i = 0; i < 35 && !(await page.locator(myTurnSelector).count()); i++) {
      // 极少数情况下需要先归还超载宝石。
      if (await page.locator('.discard-grid').count()) break;
      await page.waitForTimeout(350);
    }
    if (await page.locator('.discard-grid').count()) {
      const must = Number((await page.locator('.discard-footer').innerText()).match(/(\d+)\s*枚/)?.[1] || 1);
      for (let i = 0; i < must; i++) {
        const plus = page.locator('.discard-item .di-stepper button[aria-label="增加"]:not([disabled])').first();
        if (!(await plus.count())) break;
        await plus.click();
        await page.waitForTimeout(100);
      }
      await page.click('.discard-footer button:has-text("确认归还")');
      await page.waitForTimeout(500);
      continue;
    }
    if (!(await page.locator(myTurnSelector).count())) throw new Error('等待自己的回合超时');

    await page.locator('.reserved-slot.has-card .card, .m-reserved .card').first().click();
    await page.waitForSelector('.modal');
    const buy = page.locator('.modal button:has-text("购入卡牌")');
    if (await buy.isEnabled()) {
      await buy.click();
      bought = true;
      break;
    }
    await page.click('.modal-close');

    const tokens = page.locator('.bank-token:not(.is-empty):not([disabled]), .m-token:not(.is-empty):not([disabled])');
    const count = Math.min(3, await tokens.count());
    for (let i = 0; i < count; i++) {
      await tokens.nth(i).click();
      await page.waitForTimeout(90);
    }
    const take = page.locator('.action-buttons button:has-text("拿取"), .m-take-btn');
    if (!(await take.isEnabled())) throw new Error('拿取按钮不可用');
    await take.click();
    await page.waitForTimeout(650);
  }

  if (!bought) throw new Error('多轮后仍无法购买保留卡');
  await page.waitForTimeout(600);
  const remaining = await page.locator('.reserved-slot.has-card, .m-reserved').count();
  if (remaining !== 0) throw new Error('购买后保留卡没有移除');

  // 保留卡购入后也必须进入永久图鉴。
  if (mobile) {
    await page.click('button[aria-label="更多"]');
    await page.click('.m-menu-item:has-text("宝石图鉴")');
  } else {
    await page.click('button[aria-label="宝石图鉴"]');
  }
  await page.waitForSelector('.collection-grid');
  const collected = await page.locator('.collection-card.is-owned').count();
  if (collected !== 1) throw new Error(`保留卡购买后的图鉴数量错误：${collected}`);
  await page.screenshot({ path: `shots/reserved-purchased-${mobile ? 'mobile' : 'desktop'}.png` });
  console.log(`${mobile ? 'mobile' : 'desktop'}: reserved purchase ok, collection=${collected}, errors=${errors.length}`);
  await context.close();
}

await verifyReservedPurchase(1600, 1000, false);
await verifyReservedPurchase(844, 390, true);
await browser.close();
