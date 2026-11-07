import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sourceDir = 'art-src/noble-anime';
const outputDir = 'public/assets/art/anime';
fs.mkdirSync(outputDir, { recursive: true });

const ids = ['mary', 'suleiman', 'machiavelli', 'isabella', 'henry', 'catherine', 'anne', 'elisabeth', 'francis', 'charles'];
for (const id of ids) {
  const input = path.join(sourceDir, `noble-${id}.png`);
  if (!fs.existsSync(input)) throw new Error(`缺少贵族原画：${input}`);
  await sharp(input).resize(480, 560, { fit: 'cover', position: 'top' }).webp({ quality: 88 }).toFile(path.join(outputDir, `noble-${id}.webp`));
}
console.log(`已生成 ${ids.length} 张动漫贵族肖像：${outputDir}`);