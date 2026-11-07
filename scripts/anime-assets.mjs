import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sourceDir = 'art-src/anime';
const outputDir = 'public/assets/art/anime';
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync('shots', { recursive: true });

// 90 张发展卡各自一张独立动漫原画：五色 × 三阶 × 每阶 8/6/4 张。
const ids = [];
for (const color of ['w', 'b', 'g', 'r', 'k']) {
  for (const [tier, count] of [[1, 8], [2, 6], [3, 4]]) {
    for (let i = 1; i <= count; i += 1) {
      ids.push(`${color}${tier}-${String(i).padStart(2, '0')}`);
    }
  }
}

let done = 0;
const tiles = [];
for (const [index, id] of ids.entries()) {
  const input = path.join(sourceDir, `${id}.png`);
  if (!fs.existsSync(input)) throw new Error(`缺少动漫原画：${input}`);
  await sharp(input).resize(640, 960, { fit: 'cover' }).webp({ quality: 86 }).toFile(path.join(outputDir, `${id}.webp`));
  if (index % 5 === 0) {
    const data = await sharp(input).resize(160, 240, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer();
    tiles.push({ input: data, left: (tiles.length % 6) * 160, top: Math.floor(tiles.length / 6) * 240 });
  }
  done += 1;
  if (done % 15 === 0) console.log(`  ${done}/${ids.length}`);
}

await sharp({ create: { width: 960, height: 720, channels: 3, background: '#100b12' } })
  .composite(tiles.slice(0, 18))
  .jpeg({ quality: 90 })
  .toFile('shots/anime-contact.jpg');

console.log(`已生成 ${ids.length} 张动漫卡面：${outputDir}`);
