import { chromium } from 'playwright-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: false });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto('about:blank');
for (let i = 0; i < 8; i += 1) {
  const n = await page.evaluate(() => window.speechSynthesis.getVoices().length);
  if (n > 0) {
    const list = await page.evaluate(() => window.speechSynthesis.getVoices().map((v) => `${v.name}|${v.lang}`));
    console.log('after', i, 'sec', n, list.slice(0, 8));
    break;
  }
  await page.waitForTimeout(1000);
}
const finalN = await page.evaluate(() => window.speechSynthesis.getVoices().length);
console.log('final', finalN);
await browser.close();
