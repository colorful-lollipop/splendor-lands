/**
 * 完整合法动作枚举（与 `train/splendor_env.py` 的 legal_actions 一一对应）。
 * 神经网络训练时见过全部合法动作，推理时也必须用同一套枚举，否则分布不一致。
 */

import { COLORS, CARD_BY_ID, NOBLE_BY_ID, cardCost, paymentFor } from './rules.mjs';

const ALL = [...COLORS, 'gold'];

export function listAllActions(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || state.finished) return [];

  if (state.phase === 'noble') {
    return (state.pending?.options || []).map((id) => ({ type: 'chooseNoble', nobleId: id }));
  }

  if (state.phase === 'discard') {
    const need = state.pending?.mustReturn || 0;
    const pool = ALL.filter((c) => player.tokens[c] > 0);
    const opts = [];
    const cur = { w: 0, b: 0, g: 0, r: 0, k: 0, gold: 0 };
    const rec = (idx, left) => {
      if (left === 0) {
        opts.push({ type: 'returnTokens', tokens: { ...cur } });
        return;
      }
      if (idx >= pool.length) return;
      const c = pool[idx];
      for (let take = Math.min(left, player.tokens[c]); take >= 0; take -= 1) {
        cur[c] = take;
        rec(idx + 1, left - take);
        cur[c] = 0;
      }
    };
    rec(0, need);
    // 组合过多时保留前面的若干条，避免弹栈
    return opts.slice(0, 200);
  }

  const acts = [];
  const avail = COLORS.filter((c) => state.tokens[c] > 0);
  const want = Math.min(3, avail.length);
  if (want >= 1) {
    const combos = [];
    const walk = (start, acc) => {
      if (acc.length === want) {
        combos.push([...acc]);
        return;
      }
      for (let i = start; i < avail.length; i += 1) {
        acc.push(avail[i]);
        walk(i + 1, acc);
        acc.pop();
      }
    };
    walk(0, []);
    for (const combo of combos) acts.push({ type: 'take', colors: combo });
    for (const c of avail) {
      if (state.tokens[c] >= 4) acts.push({ type: 'take', colors: [c, c] });
    }
  }

  const buyable = (id) => paymentFor(CARD_BY_ID.get(id), player).affordable;
  for (const tier of [1, 2, 3]) {
    state.board[tier].forEach((id, index) => {
      if (id && buyable(id)) acts.push({ type: 'buy', source: { kind: 'board', tier, index } });
    });
  }
  for (const id of player.reserved || []) {
    if (buyable(id)) acts.push({ type: 'buy', source: { kind: 'reserved', cardId: id } });
  }

  if ((player.reserved?.length || 0) < 3) {
    for (const tier of [1, 2, 3]) {
      state.board[tier].forEach((id, index) => {
        if (id) acts.push({ type: 'reserve', source: { kind: 'board', tier, index } });
      });
      if ((state.decks[tier] || 0) > 0) acts.push({ type: 'reserve', source: { kind: 'deck', tier } });
    }
  }

  return acts;
}

export { NOBLE_BY_ID, cardCost };