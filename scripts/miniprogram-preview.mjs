import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const wxss = fs.readFileSync('miniprogram/pages/index/index.wxss', 'utf8');
const css = wxss.replace(/([\d.]+)rpx/g, (_, n) => `${(Number(n) / 7.5).toFixed(4)}vw`);
const cover = path.resolve('miniprogram/assets/cover.jpg').replace(/\\/g, '/');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#0a0704}
body{font-family:"Songti SC","Noto Serif SC","STSong",serif;color:#ecdcbb;overflow:hidden}
${css}
</style></head><body>
<div class="stage">
  <img class="backdrop" src="file:///${cover}">
  <div class="veil"></div><div class="glow"></div>
  <div class="topbar"><div class="brand"><span class="gem">◆</span><span class="brand-name">SPLENDOR</span></div><span class="edition">线上桌游</span></div>
  <div class="content">
    <span class="kicker">宝石商人的文艺复兴</span>
    <span class="title">璀璨宝石</span>
    <span class="subtitle">收集宝石，购入发展卡，赢取贵族的青睐。</span>
    <div class="chips"><span class="chip">2–4 人在线</span><span class="chip">横屏游玩</span><span class="chip">无需下载</span></div>
    <button class="enter"><span class="enter-main">进入牌桌</span><span class="enter-sub">ENTER THE TABLE</span></button>
    <span class="hint">首次进入会加载卡面素材，请稍候片刻</span>
  </div>
  <span class="foot">非官方粉丝作品 · 规则遵循 Marc André 的 Splendor</span>
</div>
</body></html>`;

fs.mkdirSync('shots', { recursive: true });
fs.writeFileSync('shots/mp-preview.html', html);

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
for (const [width, height] of [[375, 667], [390, 844], [430, 932], [768, 1024]]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto('file:///' + path.resolve('shots/mp-preview.html').replace(/\\/g, '/'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/mp-preview-${width}.png` });
  await context.close();
}
await browser.close();
console.log('preview written to shots/mp-preview-*.png');