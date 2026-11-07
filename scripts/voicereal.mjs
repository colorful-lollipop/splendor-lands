import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const voices = await page.evaluate(() => (window.speechSynthesis?.getVoices() || []).map((v) => `${v.name}|${v.lang}`));
console.log('voices', voices.length, voices.slice(0, 6));

await page.click('.landing-nav .icon-btn[aria-label="语音开关"]');
await page.waitForTimeout(2500);
console.log('speaking', await page.evaluate(() => window.speechSynthesis?.speaking));
await page.screenshot({ path: 'shots/voice-real.png' });
console.log('errors', errs.slice(0, 4));
await browser.close();
