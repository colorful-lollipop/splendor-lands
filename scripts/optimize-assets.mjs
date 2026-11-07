import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'art-src');
const outRoot = join(root, 'public/assets/art');

const SPEC = {
  // 卡面原图是 2:3 竖幅，卡牌是 0.79 —— 统一从顶部开始裁，
  // 保证人物头部永远不被切掉（之前用 attention 会裁到头）。
  card: { width: 512, height: 680, quality: 80, position: 'top' },
  noble: { width: 480, height: 560, quality: 82, position: 'top' },
  back: { width: 540, height: 760, quality: 80, position: 'top' },
  bg: { width: 1600, height: 900, quality: 76, position: 'attention' },
};

function specFor(name) {
  if (name.startsWith('bg-')) return SPEC.bg;
  if (name.startsWith('back-')) return SPEC.back;
  if (name.startsWith('noble-')) return SPEC.noble;
  return SPEC.card;
}

async function convert(input, output, spec) {
  mkdirSync(dirname(output), { recursive: true });
  await sharp(input)
    .resize({ width: spec.width, height: spec.height, fit: 'cover', position: spec.position || 'attention' })
    .webp({ quality: spec.quality, effort: 5 })
    .toFile(output);
  const kb = Math.round(statSync(output).size / 1024);
  return kb;
}

const report = [];

async function processDir(sub) {
  const dir = join(srcRoot, sub);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => /\.png$/i.test(f));
  for (const file of files) {
    const name = basename(file, extname(file));
    const outDir = sub ? join(outRoot, sub) : outRoot;
    const output = join(outDir, `${name}.webp`);
    const kb = await convert(join(dir, file), output, specFor(name));
    report.push({ path: `${sub ? sub + '/' : ''}${name}.webp`, kb });
  }
}

for (const sub of ['legend', 'glass', '']) {
  await processDir(sub);
}

console.log(`转换 ${report.length} 张`);
const total = report.reduce((n, r) => n + r.kb, 0);
console.log(`总体积 ${(total / 1024).toFixed(1)} MB`);
