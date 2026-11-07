import cardsJson from '../../shared/cards.json';
import noblesJson from '../../shared/nobles.json';
import { skinCardName } from './cardNames';
import type { ArtSkin, CardData, Color, NobleData, NobleSkin, SkinSettings, TableSkin, TokenColor } from './types';

export const CARDS = cardsJson as CardData[];
export const NOBLES = noblesJson as NobleData[];
export const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));
export const NOBLE_MAP = new Map(NOBLES.map((n) => [n.id, n]));

export const COLORS: Color[] = ['w', 'b', 'g', 'r', 'k'];
export const TOKEN_COLORS: TokenColor[] = ['w', 'b', 'g', 'r', 'k', 'gold'];

export const GEM: Record<TokenColor, { name: string; en: string; hex: string; dark: string; light: string }> = {
  w: { name: '钻石', en: 'Diamond', hex: '#eae3cf', dark: '#9a917a', light: '#fffdf4' },
  b: { name: '蓝宝石', en: 'Sapphire', hex: '#3d7fe0', dark: '#173d7d', light: '#9cc4ff' },
  g: { name: '祖母绿', en: 'Emerald', hex: '#2fa86a', dark: '#0d4e31', light: '#8ff0bb' },
  r: { name: '红宝石', en: 'Ruby', hex: '#c4333d', dark: '#5c1018', light: '#ff9a9a' },
  k: { name: '黑曜石', en: 'Onyx', hex: '#4a4356', dark: '#171420', light: '#9c92b0' },
  gold: { name: '黄金', en: 'Gold', hex: '#e0a63a', dark: '#6b4510', light: '#ffe294' },
};

export const CARD_NAMES: Record<string, string[]> = {};

const TIER_ROMAN = ['', 'I', 'II', 'III'];

export function cardName(card: CardData, skin: ArtSkin = 'legend'): string {
  return skinCardName(card, skin);
}

export function tierRoman(tier: number): string {
  return TIER_ROMAN[tier] || String(tier);
}

export const TIER_INFO: Record<number, { label: string; sub: string }> = {
  1: { label: '一级', sub: '学徒与商贩' },
  2: { label: '二级', sub: '商会与名家' },
  3: { label: '三级', sub: '王庭与传奇' },
};

export function cardArt(art: string, skin: ArtSkin = 'legend'): string {
  if (skin === 'anime') {
    // 动漫主题 90 张卡各自拥有独立原画，按卡牌 art id 一一对应。
    return `/assets/art/anime/${art}.webp`;
  }
  return `/assets/art/${skin}/${art}.webp`;
}

export function nobleArt(id: string, skin: NobleSkin = 'oil'): string {
  const folder = skin === 'glass' ? 'glass' : 'legend';
  return `/assets/art/${folder}/noble-${id}.webp`;
}

export function tokenTotal(tokens: Partial<Record<TokenColor, number>>): number {
  return TOKEN_COLORS.reduce((n, c) => n + (tokens[c] || 0), 0);
}

export function totalBonuses(bonuses: Record<Color, number>): number {
  return COLORS.reduce((n, c) => n + (bonuses[c] || 0), 0);
}

export interface PaymentInfo {
  need: Record<Color, number>;
  gold: number;
  affordable: boolean;
  missing: number;
}

export function computePayment(card: CardData, bonuses: Record<Color, number>, tokens: Record<TokenColor, number>): PaymentInfo {
  const need = {} as Record<Color, number>;
  let gold = 0;
  let missing = 0;
  for (const c of COLORS) {
    need[c] = Math.max(0, (card.cost[c] || 0) - (bonuses[c] || 0));
    const useGem = Math.min(need[c], tokens[c] || 0);
    gold += need[c] - useGem;
    if (need[c] > useGem) missing += need[c] - useGem;
  }
  return { need, gold, affordable: gold <= (tokens.gold || 0), missing: Math.max(0, gold - (tokens.gold || 0)) };
}

export const DEFAULT_SKINS: SkinSettings = {
  frame: 'gilded',
  art: 'legend',
  gems: 'faceted',
  back: 'emerald',
  table: 'tavern',
  noble: 'oil',
  avatar: 'w1',
};

/** 每套卡面画风都配套一整套外观，一键切换即可获得完整主题。 */
export const ART_PRESETS: Record<ArtSkin, Omit<SkinSettings, 'art' | 'avatar'>> = {
  legend: { frame: 'gilded', gems: 'faceted', back: 'emerald', table: 'tavern', noble: 'oil' },
  glass: { frame: 'frost', gems: 'crystal', back: 'astral', table: 'astral', noble: 'glass' },
  anime: { frame: 'jade', gems: 'rune', back: 'crimson', table: 'velvet', noble: 'oil' },
};

export const SKIN_OPTIONS = {
  frame: [
    { id: 'gilded', name: '黄金时代', desc: '暖金雕花与胡桃木，炉石酒馆的经典质感。', swatch: ['#f6df9d', '#c9963f', '#3a2410'] },
    { id: 'jade', name: '翡翠梦境', desc: '青玉与银叶，幽静而华贵。', swatch: ['#d7f2d9', '#59a87c', '#11291f'] },
    { id: 'frost', name: '霜银王座', desc: '寒银与冰蓝，如北境宫廷。', swatch: ['#eaf5ff', '#8fb4d9', '#152030'] },
    { id: 'abyss', name: '深渊余烬', desc: '黑铁与余火，暗影中的低语。', swatch: ['#f3b47a', '#a3562c', '#211318'] },
  ],
  art: [
    { id: 'legend', name: '传奇油画', desc: '90 张独立原画，鎏金雕花与文艺复兴的写实名号。' },
    { id: 'glass', name: '彩窗圣殿', desc: '90 张彩绘玻璃原画，哥特尖拱与铅条圣光，卡名化为圣殿祷歌。' },
    { id: 'anime', name: '星轨绘旅', desc: '90 张逐卡独立的动漫幻想原画，镭射卡框与「称号·人名」的二次元命名。' },
  ],
  gems: [
    { id: 'faceted', name: '切面宝石', desc: '经典多切面宝石，璀璨通透。' },
    { id: 'coin', name: '古国金币', desc: '錾刻金币中央镶嵌宝石，厚重古朴。' },
    { id: 'crystal', name: '原始晶簇', desc: '未经打磨的天然晶柱，灵光流转。' },
    { id: 'rune', name: '秘法符文', desc: '刻有远古符文的石质护符。' },
  ],
  back: [
    { id: 'emerald', name: '翡翠龙纹', desc: '祖母绿与黄金的古典牌背。' },
    { id: 'crimson', name: '赤炎龙纹', desc: '红宝石与黑金，危险而华美。' },
    { id: 'astral', name: '星界航图', desc: '午夜蓝与星辰，占星师的珍藏。' },
  ],
  table: [
    { id: 'tavern', name: '酒馆橡木桌', desc: '绿绒桌布与烛光，暖意盎然。' },
    { id: 'astral', name: '星界大理石', desc: '深蓝金星石面，神秘高贵。' },
    { id: 'velvet', name: '翡翠丝绒', desc: '深绿天鹅绒与金线暗纹，柔软细腻。' },
    { id: 'ember', name: '熔火黑石', desc: '玄武岩间流动的赤红余烬。' },
  ],
  noble: [
    { id: 'oil', name: '宫廷油画', desc: '文艺复兴肖像原画，10 位贵族各一幅。' },
    { id: 'glass', name: '彩窗圣像', desc: '同一批贵族的彩绘玻璃版本，金线勾边。' },
  ],
} as const;

export const AVATAR_OPTIONS = [
  'w1', 'w2', 'w3', 'b1', 'b2', 'b3', 'g1', 'g2', 'g3', 'r1', 'r2', 'r3', 'k1', 'k2', 'k3',
  'noble-mary', 'noble-charles', 'noble-machiavelli', 'noble-isabella', 'noble-suleiman',
  'noble-catherine', 'noble-anne', 'noble-henry', 'noble-elisabeth', 'noble-francis',
];

export function avatarArt(key: string, skin: ArtSkin = 'legend'): string {
  if (/^[wbgkr][123]$/.test(key)) return cardArt(`${key}-01`, skin);
  const folder = skin === 'glass' ? 'glass' : 'legend';
  return `/assets/art/${folder}/${key}.webp`;
}

export function backArt(key: string): string {
  return `/assets/art/back-${key}.webp`;
}

export function tableArt(key: TableSkin): string {
  if (key === 'astral') return '/assets/art/bg-astral.webp';
  if (key === 'velvet') return '/assets/art/bg-velvet.webp';
  if (key === 'ember') return '/assets/art/bg-ember.webp';
  return '/assets/art/bg-tavern.webp';
}