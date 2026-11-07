import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CARD_ART } from './art-manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const COLOR_BY_NAME = {
  White: 'w',
  Blue: 'b',
  Green: 'g',
  Red: 'r',
  Black: 'k',
};

// 每色 18 张：一级 8、二级 6、三级 4
const CARD_NAMES = {
  w: [
    '钻石学徒', '白衣珠宝匠', '山间采钻人', '精密切割师', '银冠学徒', '雪原寻钻者', '光辉学徒', '冰晶匠人',
    '北境商队', '白纱行商', '雪夜货运', '极光商会', '白银经纪人', '冰原掮客',
    '冰霜女王', '钻石王座', '水晶宫廷', '极光女爵',
  ],
  b: [
    '蓝宝石矿工', '河畔淘洗者', '幽蓝学徒', '深蓝拾荒者', '潮汐采集人', '蓝石矿脉工', '静谧潜水者', '暗流商人',
    '星图学者', '蓝晶法师', '卷轴收藏家', '奥术珠宝师', '深空占星者', '月蓝书记官',
    '海渊巨蛇', '蓝晶塔守卫', '风暴海商', '深渊领航者',
  ],
  g: [
    '丛林草药师', '翡翠采摘人', '藤蔓学徒', '雨林珠宝匠', '苔石采集者', '绿荫商人', '密林拾翠者', '藤蔓行者',
    '精灵翡翠商', '树冠集市主', '翠玉鉴宝师', '林间宝石匠', '古树珠宝商', '绿光行商',
    '翡翠古龙', '翠玉神殿守卫', '常青女祭司', '藤蔓巨龙',
  ],
  r: [
    '火山锻工', '熔岩宝石匠', '赤红矿工', '炉火学徒', '余烬采集者', '烈焰切割师', '红石搬运工', '炽热铁匠',
    '赤焰商队', '熔岩货运商', '烈焰掮客', '火岩商会', '红晶行商', '灰烬经纪',
    '浴火凤凰', '赤晶巨像', '熔炉领主', '烈焰君王',
  ],
  k: [
    '幽影盗宝人', '黑曜石窃贼', '墓穴拾荒者', '暗巷学徒', '影中商人', '黑晶走私者', '夜行收集人', '幽暗掘墓人',
    '暗夜集市主', '紫灯黑市商', '黑曜珠宝师', '影纱经纪人', '夜雾行商', '暗影典当师',
    '黑曜骑士', '暗影王座', '虚空领主', '幽夜君王',
  ],
};

const rawCards = readFileSync(join(root, 'data/cards.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
const counters = {};
const cards = rawCards.map((line) => {
  const [level, colorName, points, black, blue, green, red, white] = line.split(',').map((v) => v.trim());
  const bonus = COLOR_BY_NAME[colorName];
  const tier = Number(level);
  const key = `${tier}${bonus}`;
  counters[key] = (counters[key] || 0) + 1;
  const seq = counters[key];
  const nameIndex = tier === 1 ? seq - 1 : tier === 2 ? 8 + (seq - 1) : 14 + (seq - 1);
  return {
    id: `${bonus}${tier}-${String(seq).padStart(2, '0')}`,
    tier,
    bonus,
    points: Number(points),
    art: `${bonus}${tier}-${String(seq).padStart(2, '0')}`,
    name: CARD_ART.find((a) => a.id === `${bonus}${tier}-${String(seq).padStart(2, '0')}`)?.name || `${bonus}${tier}-${seq}`,
    cost: {
      k: Number(black),
      b: Number(blue),
      g: Number(green),
      r: Number(red),
      w: Number(white),
    },
  };
});

const NOBLE_META = [
  ['mary', '玛丽·斯图亚特', 'Mary Stuart', '苏格兰女王'],
  ['charles', '查理五世', 'Charles V', '神圣罗马帝国皇帝'],
  ['machiavelli', '马基雅维利', 'Niccolò Machiavelli', '佛罗伦萨外交家'],
  ['isabella', '伊莎贝拉一世', 'Isabella I', '卡斯蒂利亚女王'],
  ['suleiman', '苏莱曼大帝', 'Suleiman the Magnificent', '奥斯曼帝国苏丹'],
  ['catherine', '凯瑟琳·德·美第奇', 'Catherine de Médicis', '法兰西王后'],
  ['anne', '布列塔尼的安妮', 'Anne of Brittany', '布列塔尼女公爵'],
  ['henry', '亨利八世', 'Henry VIII', '英格兰国王'],
  ['elisabeth', '奥地利的伊丽莎白', 'Elisabeth of Austria', '法兰西王后'],
  ['francis', '弗朗索瓦一世', 'Francis I', '法兰西国王'],
];

const NAMES_BY_COST = {
  g4r4: 'mary',
  b4g4: 'suleiman',
  w4b4: 'machiavelli',
  w4k4: 'isabella',
  r4k4: 'henry',
  b3g3r3: 'catherine',
  w3b3g3: 'anne',
  w3b3k3: 'elisabeth',
  w3r3k3: 'francis',
  g3r3k3: 'charles',
};

const rawNobles = readFileSync(join(root, 'data/nobles.csv'), 'utf8').trim().split(/\r?\n/).slice(1);
const nobles = rawNobles.map((line) => {
  const [r, g, b, w, k] = line.split(',').map((v) => Number(v.trim()));
  const cost = { w, b, g, r, k };
  const key = ['w', 'b', 'g', 'r', 'k']
    .filter((c) => cost[c] > 0)
    .map((c) => c + cost[c])
    .join('');
  const meta = NOBLE_META.find(([id]) => id === NAMES_BY_COST[key]);
  if (!meta) throw new Error(`Unknown noble cost ${key}`);
  return { id: meta[0], name: meta[1], nameEn: meta[2], title: meta[3], points: 3, art: meta[0], cost };
});

if (cards.length !== 90) throw new Error(`Expected 90 cards, got ${cards.length}`);
if (nobles.length !== 10) throw new Error(`Expected 10 nobles, got ${nobles.length}`);

mkdirSync(join(root, 'shared'), { recursive: true });
writeFileSync(join(root, 'shared/cards.json'), JSON.stringify(cards, null, 2) + '\n');
writeFileSync(join(root, 'shared/nobles.json'), JSON.stringify(nobles, null, 2) + '\n');
writeFileSync(
  join(root, 'shared/data.mjs'),
  `// 由 scripts/build-data.mjs 自动生成，请勿手改。\nexport const CARDS = ${JSON.stringify(cards)};\n\nexport const NOBLES = ${JSON.stringify(nobles)};\n`,
);
console.log(`cards: ${cards.length}, nobles: ${nobles.length}`);