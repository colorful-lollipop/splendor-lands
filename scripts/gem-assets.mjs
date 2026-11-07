import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'art-src/gems');
const outDir = join(root, 'public/assets/gems');

const THRESH = 26;
const PAD = 0.08;

/** 从四边洪泛填充，抠掉纯黑背景；保留宝石内部深色刻面 */
function cutout(data, w, h) {
  const bg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const isBg = (i) => {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    return Math.max(r, g, b) <= THRESH;
  };
  for (let x = 0; x < w; x += 1) {
    if (isBg(x)) { bg[x] = 1; stack[sp++] = x; }
    const i = (h - 1) * w + x;
    if (isBg(i) && !bg[i]) { bg[i] = 1; stack[sp++] = i; }
  }
  for (let y = 0; y < h; y += 1) {
    const i = y * w;
    if (isBg(i) && !bg[i]) { bg[i] = 1; stack[sp++] = i; }
    const j = y * w + w - 1;
    if (isBg(j) && !bg[j]) { bg[j] = 1; stack[sp++] = j; }
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    const y = (i / w) | 0;
    const push = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const ni = ny * w + nx;
      if (bg[ni]) return;
      if (!isBg(ni)) return;
      bg[ni] = 1;
      stack[sp++] = ni;
    };
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return bg;
}

const files = readdirSync(srcDir).filter((f) => /\.png$/i.test(f) && !f.startsWith('test-'));
mkdirSync(outDir, { recursive: true });

for (const file of files) {
  const name = basename(file, extname(file));
  const img = sharp(join(srcDir, file)).resize({ width: 640, height: 640, fit: 'inside' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  if (channels !== 3) throw new Error(`${file} has ${channels} channels`);

  const bg = cutout(data, w, h);

  // 边界羽化：用 3x3 均值近似
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i += 1) alpha[i] = bg[i] ? 0 : 255;

  // bbox
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (alpha[y * w + x] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const side = Math.round(Math.max(bw, bh) * (1 + PAD * 2));
  const left = Math.round((side - bw) / 2);
  const top = Math.round((side - bh) / 2);

  const rgba = Buffer.alloc(side * side * 4, 0);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const si = (minY + y) * w + (minX + x);
      const di = ((top + y) * side + (left + x)) * 4;
      rgba[di] = data[si * 3];
      rgba[di + 1] = data[si * 3 + 1];
      rgba[di + 2] = data[si * 3 + 2];
      rgba[di + 3] = alpha[si];
    }
  }

  const out = join(outDir, `${name}.webp`);
  await sharp(rgba, { raw: { width: side, height: side, channels: 4 } })
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(out);
  console.log(`${name}.webp  ${bw}x${bh} -> ${side}`);
}

writeFileSync(join(outDir, '.gitkeep'), '');
console.log('done');
