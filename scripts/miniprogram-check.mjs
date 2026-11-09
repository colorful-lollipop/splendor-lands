import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = 'miniprogram';
const required = [
  'app.js',
  'app.json',
  'app.wxss',
  'config.js',
  'project.config.json',
  'sitemap.json',
  'assets/cover.jpg',
  'assets/share.jpg',
  'pages/index/index.js',
  'pages/index/index.json',
  'pages/index/index.wxml',
  'pages/index/index.wxss',
  'pages/game/game.js',
  'pages/game/game.json',
  'pages/game/game.wxml',
  'pages/game/game.wxss',
];

const errors = [];
for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) errors.push(`缺少文件：${full}`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    errors.push(`${file} 不是合法 JSON：${error.message}`);
    return null;
  }
}

const app = readJson('app.json');
const project = readJson('project.config.json');
const indexPage = readJson('pages/index/index.json');
const gamePage = readJson('pages/game/game.json');

for (const page of app?.pages || []) {
  for (const ext of ['js', 'json', 'wxml', 'wxss']) {
    if (!fs.existsSync(path.join(root, `${page}.${ext}`))) errors.push(`页面缺少 ${page}.${ext}`);
  }
}

if (indexPage?.navigationStyle !== 'custom') errors.push('首页应使用自定义导航栏，避免与封面重复');
if (gamePage?.pageOrientation !== 'landscape') errors.push('牌桌页必须设置 pageOrientation=landscape');
if (!gamePage?.disableScroll) errors.push('牌桌页应设置 disableScroll=true');
if (project?.appid === 'touristappid') {
  console.warn('提示：project.config.json 仍是 touristappid，发布前请替换为真实 AppID');
}

const configText = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
const url = configText.match(/gameUrl:\s*'([^']+)'/)?.[1];
if (!url || !url.startsWith('https://')) errors.push('config.js 的 gameUrl 必须是 HTTPS 地址');

let total = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else total += fs.statSync(full).size;
  }
}
walk(root);
if (total > 2 * 1024 * 1024) errors.push(`小程序包超过 2MB：${(total / 1024).toFixed(0)}KB`);

for (const [file, width, height] of [
  ['assets/cover.jpg', 750, 1200],
  ['assets/share.jpg', 500, 400],
]) {
  const meta = await sharp(path.join(root, file)).metadata();
  if (meta.width !== width || meta.height !== height) {
    errors.push(`${file} 尺寸应为 ${width}×${height}，实际 ${meta.width}×${meta.height}`);
  }
}

if (url) {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) errors.push(`线上健康检查失败：HTTP ${response.status}`);
  } catch (error) {
    errors.push(`无法访问线上服务：${error.message}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ 小程序结构完整，包体 ${(total / 1024).toFixed(0)}KB，线上地址 ${url}`);