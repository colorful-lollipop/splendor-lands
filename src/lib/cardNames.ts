import cardsJson from '../../shared/cards.json';
import type { ArtSkin, CardData, Color } from './types';

/**
 * 三套卡面各自拥有完整的命名体系。
 * 同一个卡牌 id 在不同画风下会呈现完全不同的名字与气质：
 * - 传奇油画：文艺复兴商人与收藏家的写实名号
 * - 彩窗圣殿：教堂彩窗与圣物传说的宗教式名号
 * - 星轨绘旅：动漫幻想风格的「称号·人名」
 */
type ColorNames = Record<Color, string[]>;

const GLASS_NAMES: ColorNames = {
  w: [
    '白晶祷者', '圣光采石人', '霜辉侍僧', '琉璃拾光者', '晨星研磨匠', '纯白唱诗童',
    '圣坛守灯人', '雪窗学徒', '银辉诵经者', '穹顶鉴宝师', '白鸽圣咏者', '圣匣保管人',
    '圣光司库', '白玉经师', '极光主教', '白蔷薇圣女', '永昼圣母', '圣辉钻石天使',
  ],
  b: [
    '苍蓝侍僧', '海窗拾贝人', '深蓝诵咏者', '蓝晶研光匠', '潮汐唱诗者', '圣蓝守灯人',
    '夜航祷者', '幽蓝见习修士', '星蓝鉴宝师', '蔚蓝圣咏者', '圣匣航海士', '琉璃海祭司',
    '苍蓝司库', '海图经师', '深空主教', '海渊圣女', '星海圣母', '蓝晶圣天使',
  ],
  g: [
    '翠光侍僧', '藤窗采摘人', '苔绿祷者', '翡翠研光匠', '林间唱诗者', '圣绿守灯人',
    '露珠诵经人', '青藤学徒', '苍翠鉴宝师', '林穹圣咏者', '圣匣园丁', '琉璃叶祭司',
    '翠玉司库', '森语经师', '常青主教', '绿荫圣女', '万木圣母', '翡翠圣天使',
  ],
  r: [
    '赤光侍僧', '焰窗锻石人', '绯红祷者', '蔷薇研光匠', '炉火唱诗者', '圣焰守灯人',
    '余烬诵经人', '熔红学徒', '赤晶鉴宝师', '烈焰圣咏者', '圣匣铸师', '琉璃火祭司',
    '赤焰司库', '焚香经师', '浴火主教', '红莲圣女', '焚心圣母', '赤焰圣天使',
  ],
  k: [
    '暗光侍僧', '暮窗拾影人', '紫夜祷者', '黑曜研光匠', '幽影唱诗者', '圣夜守灯人',
    '月蚀诵经人', '暗紫学徒', '墨晶鉴宝师', '永夜圣咏者', '圣匣守夜人', '琉璃影祭司',
    '暗影司库', '月蚀经师', '月蚀主教', '夜蔷薇圣女', '永夜圣母', '黑曜圣天使',
  ],
};

const ANIME_NAMES: ColorNames = {
  w: [
    '白夜·绘旅人', '霜星·拾光者', '银雪·研钻师', '晨光·琉璃匠', '星轨·白蔷薇', '雪羽·观测者',
    '纯白·织梦师', '曙光·学徒', '极光·鉴赏家', '月白·占星者', '银冠·收藏家', '冰晶·调律师',
    '白纱·拍卖师', '霜语·经纪人', '永昼·女王', '白鸽·誓约者', '雪境·女帝', '圣辉·天使长',
  ],
  b: [
    '苍蓝·航海士', '潮汐·拾贝人', '深蓝·潜行者', '星海·观测者', '月蓝·书记官', '蓝晶·术士',
    '夜航·绘旅人', '幽蓝·学徒', '蔚蓝·鉴宝师', '深空·占星者', '海图·收藏家', '琉璃·调律师',
    '蓝晶·拍卖师', '潮声·经纪人', '海渊·女帝', '潮汐·誓约者', '星海·女王', '深蓝·天使长',
  ],
  g: [
    '翠叶·绘旅人', '苔石·采集者', '林光·药师', '翡翠·研光师', '青藤·织梦师', '露珠·观测者',
    '绿荫·拾翠者', '森语·学徒', '苍翠·鉴赏家', '树冠·占星者', '古树·收藏家', '翠玉·调律师',
    '藤蔓·拍卖师', '绿光·经纪人', '常青·女帝', '林间·誓约者', '森罗·女王', '翠光·天使长',
  ],
  r: [
    '绯红·锻火师', '熔岩·宝石匠', '余烬·采集者', '赤晶·研光师', '烈焰·绘旅人', '炉火·观测者',
    '红石·搬运工', '炉心·学徒', '赤焰·鉴赏家', '火岩·占星者', '蔷薇·收藏家', '赤晶·调律师',
    '焰羽·拍卖师', '余温·经纪人', '浴火·女帝', '焰羽·誓约者', '红莲·女王', '赤焰·天使长',
  ],
  k: [
    '暗夜·盗宝人', '黑曜·窃贼', '影纱·潜入者', '墨晶·研光师', '紫夜·绘旅人', '幽影·观测者',
    '夜雾·行商', '暗巷·学徒', '黑晶·鉴赏家', '月蚀·占星者', '夜蔷薇·收藏家', '黑曜·调律师',
    '暗影·拍卖师', '幽穹·经纪人', '永夜·女帝', '影月·誓约者', '虚空·女王', '黑曜·天使长',
  ],
};

const NAMES_BY_SKIN: Partial<Record<ArtSkin, ColorNames>> = {
  glass: GLASS_NAMES,
  anime: ANIME_NAMES,
};

/** 同一颜色内按「等级 → id」排序后的序号，用来稳定对应命名表。 */
const COLOR_INDEX = new Map<string, number>();
{
  const groups = new Map<Color, CardData[]>();
  for (const card of cardsJson as CardData[]) {
    const list = groups.get(card.bonus) || [];
    list.push(card);
    groups.set(card.bonus, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    list.forEach((card, index) => COLOR_INDEX.set(card.id, index));
  }
}

export function skinCardName(card: CardData, skin: ArtSkin): string {
  if (skin === 'legend') return card.name || '神秘宝石卡';
  const table = NAMES_BY_SKIN[skin];
  const list = table?.[card.bonus];
  const index = COLOR_INDEX.get(card.id);
  const name = list && index !== undefined ? list[index] : undefined;
  return name || card.name || '神秘宝石卡';
}

/** 把服务端战报里的「传奇油画」卡名替换成当前画风的名字。 */
export function localizeCardText(text: string, skin: ArtSkin): string {
  if (skin === 'legend') return text;
  let result = text;
  for (const card of cardsJson as CardData[]) {
    if (card.name && result.includes(card.name)) {
      result = result.split(card.name).join(skinCardName(card, skin));
    }
  }
  return result;
}

/** 图鉴/皮肤说明里展示某套画风的完整命名规模。 */
export function skinNameCount(skin: ArtSkin): number {
  const table = NAMES_BY_SKIN[skin];
  if (!table) return 90;
  return Object.values(table).reduce((sum, list) => sum + list.length, 0);
}
