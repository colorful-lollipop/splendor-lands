import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
console.log('voices', await page.evaluate(() => (window.speechSynthesis?.getVoices() || []).length));
await page.screenshot({ path: 'shots/voice-lobby.png' });

// 开语音
await page.click('.landing-nav .icon-btn[aria-label="语音开关"]');
await page.waitForTimeout(1200);
const voiceState = await page.evaluate(() => ({
  ls: localStorage.getItem('splendor-voice'),
  speaking: window.speechSynthesis?.speaking,
}));
console.log('voice state', voiceState);
await page.screenshot({ path: 'shots/voice-on.png' });
console.log('errors', errs.slice(0, 4));
await browser.close();
