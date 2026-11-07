import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const errors = [];

for (const [skin, label] of [['legend', '传奇油画'], ['glass', '彩窗圣殿'], ['anime', '星轨绘旅']]) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript((art) => {
    localStorage.setItem('splendor-skins-v1', JSON.stringify({ frame: 'gilded', art, gems: 'faceted', back: 'emerald', table: 'tavern', noble: 'oil', avatar: 'w1' }));
  }, skin);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${skin}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${skin}: ${m.text()}`); });
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const card = page.locator('.hero-card:nth-of-type(3) .card');
  const name = await card.getAttribute('aria-label');
  await card.click();
  await page.waitForSelector('.art-lightbox');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `shots/lightbox-${skin}.png` });
  console.log(skin, name?.split('，')[0]);
  await page.click('.modal-close');
  await context.close();
}

console.log('errors', errors);
await browser.close();