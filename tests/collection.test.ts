import { describe, expect, it } from 'vitest';
import { mergeCollection } from '../src/lib/collection';

describe('永久卡牌图鉴', () => {
  it('只追加新购入的卡牌，重复对局消息不会重复收录', () => {
    const current = ['w1-01', 'b2-01'];
    const merged = mergeCollection(current, ['b2-01', 'r3-01']);

    expect(merged).toEqual(['w1-01', 'b2-01', 'r3-01']);
    expect(mergeCollection(merged, ['r3-01'])).toEqual(merged);
    expect(current).toEqual(['w1-01', 'b2-01']);
  });
});
