import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const source = 'public/assets/art/anime/w3-01.webp';
const assets = 'miniprogram/assets';
fs.mkdirSync(assets, { recursive: true });
fs.mkdirSync('docs', { recursive: true });

if (!fs.existsSync(source)) throw new Error(`缺少封面原画：${source}`);

await sharp(source)
  .resize(750, 1200, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(assets, 'cover.jpg'));

await sharp(source)
  .resize(500, 400, { fit: 'cover', position: 'north' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(path.join(assets, 'share.jpg'));

await sharp(source)
  .resize(512, 512, { fit: 'cover', position: 'north' })
  .png({ compressionLevel: 9 })
  .toFile('docs/miniprogram-icon.png');

for (const name of ['cover.jpg', 'share.jpg']) {
  const stat = fs.statSync(path.join(assets, name));
  console.log(`${name}: ${(stat.size / 1024).toFixed(0)} KB`);
}
console.log('docs/miniprogram-icon.png: 512×512，可在小程序后台作为头像上传');