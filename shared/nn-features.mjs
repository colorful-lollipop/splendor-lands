/**
 * 神经网络输入的特征编码（与 `train/features.py` 严格一一对应）。
 *
 * 任何改动都要同时改 Python 侧，否则训练/推理分布会错位。
 */

import { CARDS, NOBLES } from './data.mjs';

export const F_CARD = 16;
export const F_NOBLE = 12;
export const F_PLAYER = 18;
export const F_GLOBAL = 12;
export const F_ACTION = 40;
export const MAX_ACTIONS = 96;

export const COLORS = ['w', 'b', 'g', 'r', 'k'];
const COLOR_IDX = { w: 0, b: 1, g: 2, r: 3, k: 4 };

const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));

/** 服务端状态里 decks 是卡牌数组，之前可能已被序列化成数量 */
const deckLen = (d) => (Array.isArray(d) ? d.length : Number.isFinite(d) ? d : 0);
const NOBLE_MAP = new Map(NOBLES.map((n) => [n.id, n]));

function onehot(i, n) {
  const v = new Array(n).fill(0);
  if (i >= 0 && i < n) v[i] = 1;
  return v;
}

const EMPTY_CARD = (() => {
  const v = new Array(F_CARD).fill(0);
  v[15] = 1;
  return v;
})();

export function cardVector(card) {
  if (!card) return EMPTY_CARD.slice();
  const cost = COLORS.map((c) => card.cost[c] || 0);
  return [
    ...onehot(card.tier - 1, 3),
    ...onehot(COLOR_IDX[card.bonus], 5),
    card.points / 5,
    ...cost.map((c) => c / 4),
    card.points / 3,
    cost.reduce((a, b) => a + b, 0) / 14,
  ];
}

function paymentPlan(player, card) {
  const cost = COLORS.map((c) => Math.max(0, (card.cost[c] || 0) - (player.bonuses[c] || 0)));
  const pay = [0, 0, 0, 0, 0];
  let gold = 0;
  for (let i = 0; i < 5; i += 1) {
    const have = player.tokens[COLORS[i]] || 0;
    const use = Math.min(cost[i], have);
    pay[i] = use;
    gold += cost[i] - use;
  }
  return { ok: gold <= (player.tokens.gold || 0), pay, gold };
}

/**
 * @param {any} game 服务端规则状态（含 board/decks/nobles/tokens/players）
 * @param {number} seat 视角玩家座位
 */
export function encodeState(game, seat) {
  const me = game.players[seat];

  const cards = [];
  for (let t = 1; t <= 3; t += 1) {
    for (let i = 0; i < 4; i += 1) {
      const id = game.board[t][i];
      cards.push(cardVector(id ? CARD_MAP.get(id) : null));
    }
  }

  const nobles = [];
  for (let k = 0; k < 5; k += 1) {
    const id = game.nobles[k];
    if (!id) {
      nobles.push(new Array(F_NOBLE).fill(0));
      continue;
    }
    const noble = NOBLE_MAP.get(id);
    const cost = COLORS.map((c) => noble.cost[c] || 0);
    const missing = COLORS.map((c, i) => Math.max(0, cost[i] - (me.bonuses[c] || 0)));
    const totalMissing = missing.reduce((a, b) => a + b, 0);
    nobles.push([
      ...cost.map((c) => c / 4),
      ...missing.map((m) => m / 4),
      totalMissing === 0 ? 1 : 0,
      totalMissing / 12,
    ]);
  }

  const players = [];
  for (let k = 0; k < 4; k += 1) {
    const p = game.players[k];
    if (!p) {
      players.push(new Array(F_PLAYER).fill(0));
      continue;
    }
    const isSelf = p.seat === seat ? 1 : 0;
    players.push([
      isSelf,
      1 - isSelf,
      ...COLORS.map((c) => (p.tokens[c] || 0) / 7),
      (p.tokens.gold || 0) / 7,
      ...COLORS.map((c) => (p.bonuses[c] || 0) / 6),
      p.points / 18,
      (p.cards?.length || 0) / 12,
      (p.nobles?.length || 0) / 3,
      (p.reserved?.length || 0) / 3,
      (4 - k) / 4,
    ]);
  }

  const myTokens = COLORS.reduce((n, c) => n + (me.tokens[c] || 0), 0) + (me.tokens.gold || 0);
  const glob = [
    ...COLORS.map((c) => (game.tokens[c] || 0) / 7),
    (game.tokens.gold || 0) / 7,
    deckLen(game.decks['1']) / 36,
    deckLen(game.decks['2']) / 26,
    deckLen(game.decks['3']) / 16,
    Math.min(1, game.round / 20),
    game.endTriggered ? 1 : 0,
    myTokens / 10,
  ];

  return { cards, nobles, players, glob };
}

export function actionVector(game, action, seat) {
  const me = game.players[seat];
  const vec = new Array(F_ACTION).fill(0);
  const kind = action.type;

  if (kind === 'take') {
    for (const c of action.colors) vec[COLOR_IDX[c]] = 1;
    vec[16] = 1;
    vec[24] = action.colors.length / 3;
    vec[25] = action.colors.length === 2 && action.colors[0] === action.colors[1] ? 1 : 0;
  } else if (kind === 'chooseNoble') {
    vec[19] = 1;
    const idx = game.nobles.indexOf(action.nobleId);
    vec[23] = (idx >= 0 ? idx : 0) / 4;
  } else if (kind === 'returnTokens') {
    vec[20] = 1;
    for (let i = 0; i < 6; i += 1) {
      const c = i < 5 ? COLORS[i] : 'gold';
      vec[34 + i] = (action.tokens[c] || 0) / 3;
    }
  } else {
    const src = action.source;
    vec[kind === 'buy' ? 17 : 18] = 1;
    if (src.kind === 'board') {
      const id = game.board[src.tier][src.index];
      const card = id ? CARD_MAP.get(id) : null;
      const cv = cardVector(card);
      for (let i = 0; i < F_CARD; i += 1) vec[i] = cv[i];
      vec[23] = src.tier / 3;
      if (card && kind === 'buy') {
        const plan = paymentPlan(me, card);
        vec[26] = plan.ok ? 1 : 0;
        vec[27] = plan.gold / 3;
        vec[28] = plan.pay.reduce((a, b) => a + b, 0) / 10;
      }
    } else if (src.kind === 'deck') {
      vec[21] = 1;
      vec[23] = src.tier / 3;
    } else {
      vec[22] = 1;
      const card = CARD_MAP.get(src.cardId);
      if (card) {
        const cv = cardVector(card);
        for (let i = 0; i < F_CARD; i += 1) vec[i] = cv[i];
      }
    }
  }

  const total = COLORS.reduce((n, c) => n + (me.tokens[c] || 0), 0) + (me.tokens.gold || 0);
  vec[29] = total / 10;
  vec[30] = (me.tokens.gold || 0) / 3;
  vec[31] = me.points / 18;
  vec[32] = (me.cards?.length || 0) / 12;
  vec[33] = (me.reserved?.length || 0) / 3;
  return vec;
}

export function encodeActions(game, actions, seat) {
  const out = [];
  const mask = [];
  for (const a of actions.slice(0, MAX_ACTIONS)) {
    out.push(actionVector(game, a, seat));
    mask.push(1);
  }
  return { actions: out, mask };
}
