import fs from 'node:fs';
import sharp from 'sharp';

fs.mkdirSync('docs/screenshots', { recursive: true });
const items = [
  ['shots/landing-1600.png', 'docs/screenshots/landing.jpg', 1200],
  ['shots/game-anime.png', 'docs/screenshots/game.jpg', 1200],
  ['shots/anime-skins.png', 'docs/screenshots/skins.jpg', 1100],
  ['shots/collection-anime.png', 'docs/screenshots/collection.jpg', 1100],
];
for (const [input, output, width] of items) {
  if (!fs.existsSync(input)) throw new Error(`missing ${input}`);
  await sharp(input).resize({ width, withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(output);
  console.log(output);
}
