import { describe, expect, it } from 'vitest';
import { applyAction, CARD_BY_ID, COLORS, createGame, RuleError, TOKEN_SUPPLY_BY_PLAYERS } from '../shared/rules.mjs';

const players = (count) => Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家${i + 1}` }));

describe('官方初始设置', () => {
  it.each([
    [2, 4, 3],
    [3, 5, 4],
    [4, 7, 5],
  ])('%i 人局：每种宝石 %i 枚、黄金 5 枚、贵族 %i 位', (count, supply, nobleCount) => {
    const state = createGame({ players: players(count), seed: `setup-${count}` });

    expect(TOKEN_SUPPLY_BY_PLAYERS[count]).toBe(supply);
    for (const color of COLORS) expect(state.tokens[color]).toBe(supply);
    expect(state.tokens.gold).toBe(5);
    expect(state.nobles).toHaveLength(nobleCount);
    expect(state.decks[1]).toHaveLength(36);
    expect(state.decks[2]).toHaveLength(26);
    expect(state.decks[3]).toHaveLength(16);
  });

  it('三人局每种宝石共 5 枚，拿取两枚后剩余不足 4 枚，下家不能再拿两枚同色', () => {
    let state = createGame({ players: players(3), seed: 'three-player-supply', startPlayer: 0 });
    state = applyAction(state, 'p0', { type: 'take', colors: ['r', 'r'] });

    expect(state.tokens.r).toBe(3);
    expect(state.players[0].tokens.r).toBe(2);
    expect(() => applyAction(state, 'p1', { type: 'take', colors: ['r', 'r'] })).toThrow(RuleError);
    expect(() => applyAction(state, 'p1', { type: 'take', colors: ['r', 'r'] })).toThrow('不足 4 枚');
  });
});

describe('保留卡购买', () => {
  it('从明牌保留后，可在之后的回合购买，支付宝石并移除保留位', () => {
    let state = createGame({ players: players(2), seed: 'reserved-purchase', startPlayer: 0 });
    const cardId = state.board[1][0];
    const card = CARD_BY_ID.get(cardId);
    expect(card).toBeDefined();

    state = applyAction(state, 'p0', { type: 'reserve', source: { kind: 'board', tier: 1, index: 0 } });
    expect(state.players[0].reserved).toEqual([cardId]);
    expect(state.players[0].tokens.gold).toBe(1);
    expect(state.tokens.gold).toBe(4);

    state = applyAction(state, 'p1', { type: 'take', colors: ['w', 'b', 'g'] });
    expect(state.players[state.turn].id).toBe('p0');

    // 为这个独立规则用例准备刚好足够的宝石，验证保留来源的购买结算。
    for (const color of COLORS) state.players[0].tokens[color] = card.cost[color] || 0;
    const bankBefore = { ...state.tokens };
    state = applyAction(state, 'p0', { type: 'buy', source: { kind: 'reserved', cardId } });

    const buyer = state.players[0];
    expect(buyer.reserved).toEqual([]);
    expect(buyer.cards).toEqual([cardId]);
    expect(buyer.points).toBe(card.points);
    expect(buyer.bonuses[card.bonus]).toBe(1);
    for (const color of COLORS) {
      expect(buyer.tokens[color]).toBe(0);
      expect(state.tokens[color]).toBe(bankBefore[color] + (card.cost[color] || 0));
    }
    expect(state.players[state.turn].id).toBe('p1');
  });
});

describe('回合超时跳过', () => {
  it('pass 不改变宝石与卡牌，只把行动权交给下一位', () => {
    const before = createGame({ players: players(2), seed: 'timeout-pass', startPlayer: 0 });
    const bank = { ...before.tokens };
    const hand = { ...before.players[0].tokens };
    const state = applyAction(before, 'p0', { type: 'pass' });

    expect(state.turn).toBe(1);
    expect(state.tokens).toEqual(bank);
    expect(state.players[0].tokens).toEqual(hand);
    expect(state.players[0].cards).toEqual([]);
    expect(state.log.some((entry) => entry.text.includes('行动超时'))).toBe(true);
  });

  it('不是自己的回合不能跳过', () => {
    const state = createGame({ players: players(2), seed: 'timeout-wrong-turn', startPlayer: 0 });
    expect(() => applyAction(state, 'p1', { type: 'pass' })).toThrow(RuleError);
  });
});

