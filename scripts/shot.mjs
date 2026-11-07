import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = 'shots';
mkdirSync(OUT, { recursive: true });

const url = process.argv[2] || 'http://localhost:3001';
const name = process.argv[3] || 'lobby';
const width = Number(process.argv[4]) || 1600;
const height = Number(process.argv[5]) || 1000;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console error]', m.text());
});
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/${name}.png` });
console.log('saved', `${OUT}/${name}.png`);
await browser.close();
