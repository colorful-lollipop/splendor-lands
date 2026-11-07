import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/lib/meta';
import { localizeCardText, skinCardName } from '../src/lib/cardNames';
import type { ArtSkin } from '../src/lib/types';

describe('卡面画风的独立命名', () => {
  it('彩窗圣殿与星轨绘旅各自拥有 90 个不重复名字，且都不等同于传奇卡名', () => {
    for (const skin of ['glass', 'anime'] as ArtSkin[]) {
      const names = CARDS.map((card) => skinCardName(card, skin));
      expect(names).toHaveLength(90);
      expect(new Set(names).size).toBe(90);
      expect(names.every((name) => name.trim().length > 0)).toBe(true);
      CARDS.forEach((card, index) => {
        expect(names[index]).not.toBe(card.name);
      });
    }
  });

  it('换肤后同一张卡的名字必须不同，并保持各自的命名气质', () => {
    const card = CARDS[0];
    const legend = skinCardName(card, 'legend');
    const glass = skinCardName(card, 'glass');
    const anime = skinCardName(card, 'anime');
    expect(new Set([legend, glass, anime]).size).toBe(3);
    expect(glass).toMatch(/侍僧|祷者|圣|光|晶|影/);
    expect(anime).toMatch(/·/);
  });

  it('战报里的卡名会随画风切换', () => {
    const card = CARDS.find((c) => c.name === '浴火凤凰')!;
    const text = '◆商人 购入了「浴火凤凰」，支付 3红宝石';
    expect(localizeCardText(text, 'legend')).toBe(text);
    const glassName = skinCardName(card, 'glass');
    const animeName = skinCardName(card, 'anime');
    expect(localizeCardText(text, 'glass')).toContain(glassName);
    expect(localizeCardText(text, 'anime')).toContain(animeName);
    expect(localizeCardText(text, 'anime')).not.toContain('浴火凤凰');
    expect(skinCardName(card, 'legend')).toBe('浴火凤凰');
  });

  it('新卡名不会包含旧卡名，战报替换不会二次命中', () => {
    const legendNames = CARDS.map((card) => card.name);
    for (const skin of ['glass', 'anime'] as ArtSkin[]) {
      for (const card of CARDS) {
        const localized = skinCardName(card, skin);
        const hit = legendNames.find((name) => localized.includes(name));
        expect(hit, `${localized} 不应包含旧卡名 ${hit}`).toBeUndefined();
      }
    }
  });
});