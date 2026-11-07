import { COLORS, CARD_BY_ID, NOBLE_BY_ID, applyAction, cardCost, paymentFor } from './rules.mjs';
import { WEIGHTS } from './bot-weights.mjs';

/** 当前生效的权重（训练脚本可以通过 setWeights 临时替换） */
let W = { ...WEIGHTS };

export function setWeights(w) {
  W = { ...w };
}

export function getWeights() {
  return { ...W };
}

/* ------------------------------------------------------------------ *
 * 基础评估
 * ------------------------------------------------------------------ */

const bonusTotal = (p) => COLORS.reduce((n, c) => n + (p.bonuses[c] || 0), 0);
const tokenTotal = (p) => COLORS.reduce((n, c) => n + p.tokens[c], 0) + (p.tokens.gold || 0);

/** 距离完成某位贵族还差几张同色卡（越小越快，0 = 已满足） */
function nobleGap(player, state, extra = {}) {
  let best = 99;
  for (const id of state.nobles) {
    const noble = NOBLE_BY_ID.get(id);
    let missing = 0;
    for (const c of COLORS) {
      missing += Math.max(0, (noble.cost[c] || 0) - (player.bonuses[c] || 0) - (extra[c] || 0));
    }
    if (missing < best) best = missing;
    if (best === 0) return 0;
  }
  return best === 99 ? 5 : best;
}

/** 贵族完成度得分：越接近越高 */
function nobleScore(player, state, extra = {}) {
  const gap = nobleGap(player, state, extra);
  return gap === 0 ? 26 : Math.max(0, 14 - gap * 3.4);
}

/** 还要几枚宝石才能买下这张卡（0 = 现在就能买） */
function deficitOf(player, card) {
  const cost = cardCost(card, player.bonuses);
  let need = 0;
  let spareGold = player.tokens.gold;
  for (const c of COLORS) {
    const miss = Math.max(0, cost[c] - player.tokens[c]);
    const useGold = Math.min(miss, spareGold);
    spareGold -= useGold;
    need += miss - useGold;
  }
  return need;
}

/** 单个位置（含对手威胁）的评分，用于困难难度的前瞻 */
function evalPosition(state, myId) {
  const me = state.players.find((p) => p.id === myId);
  if (!me) return 0;
  let score = me.points * W.pointValue + me.cards.length * W.cardCountValue + bonusTotal(me) * W.bonusValue;
  score += nobleScore(me, state) * W.nobleValue;
  score += me.tokens.gold * W.goldValue;
  score -= Math.max(0, tokenTotal(me) - 8) * W.tokenPenalty;
  // 最有威胁的对手
  let threat = 0;
  for (const o of state.players) {
    if (o.id === me.id) continue;
    const s = o.points * W.pointValue + bonusTotal(o) * W.bonusValue + nobleScore(o, state) * W.nobleValue;
    if (s > threat) threat = s;
  }
  return score - threat * W.opponentWeight;
}

/**
 * 对手会买什么：估算每位对手下一手能买的最高价值卡，
 * 用来判断"要不要抢 / 要不要抢预订 / 要不要拿他缺的颜色"。
 */
function threatenedCards(state, me) {
  const map = new Map();
  for (const p of state.players) {
    if (p.id === me.id) continue;
    for (const tier of [1, 2, 3]) {
      for (const id of state.board[tier]) {
        if (!id) continue;
        const card = CARD_BY_ID.get(id);
        if (!card) continue;
        const affordNow = paymentFor(card, p).affordable;
        const closeBy = deficitOf(p, card) <= 1;
        if (!affordNow && !closeBy) continue;
        const weight = (affordNow ? 2.2 : 1) * (card.points * 1.4 + 1 + nobleScore(p, state, { [card.bonus]: 1 }) * 0.12);
        map.set(id, Math.max(map.get(id) || 0, weight));
      }
    }
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * 目标卡（"我要买哪张"）
 * ------------------------------------------------------------------ */

function cardWorth(state, me, card, threats) {
  const pay = paymentFor(card, me);
  const deficit = deficitOf(me, card);
  let v = card.points * W.cardPoints + W.cardBase;
  v += nobleScore(me, state, { [card.bonus]: 1 }) * W.cardNoble;
  // 自身薄弱的颜色更有价值
  v += Math.max(0, 3 - (me.bonuses[card.bonus] || 0)) * W.cardWeakColor;
  // 越接近能买越有价值（目标要可执行）
  v -= deficit * W.cardDeficitPenalty;
  if (!pay.affordable) v -= Math.max(0, pay.goldNeeded - me.tokens.gold) * W.cardGoldPenalty;
  // 对手也想抢的卡，价值提升
  v += (threats.get(card.id) || 0) * W.cardThreat;
  if (card.tier === 3) v += W.tier3Bonus;
  if (card.tier === 2) v += W.tier2Bonus;
  return v;
}

function pickTargets(state, me, threats, limit = 2) {
  const list = [];
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < state.board[tier].length; i += 1) {
      const id = state.board[tier][i];
      if (!id) continue;
      const card = CARD_BY_ID.get(id);
      if (!card) continue;
      list.push({ card, tier, index: i, value: cardWorth(state, me, card, threats) });
    }
  }
  for (const id of me.reserved) {
    const card = CARD_BY_ID.get(id);
    if (!card) continue;
    list.push({ card, reserved: true, value: cardWorth(state, me, card, threats) + 4.5 });
  }
  list.sort((a, b) => b.value - a.value);
  return list.slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * 动作生成
 * ------------------------------------------------------------------ */

function buyCandidates(state, me, threats) {
  const out = [];
  const push = (card, source) => {
    const pay = paymentFor(card, me);
    if (!pay.affordable) return;
    out.push({
      action: { type: 'buy', source },
      value: cardWorth(state, me, card, threats) + card.points * 3 + (pay.pay.gold > 0 ? -2.2 : 0),
    });
  };
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < state.board[tier].length; i += 1) {
      const id = state.board[tier][i];
      if (!id) continue;
      const card = CARD_BY_ID.get(id);
      if (card) push(card, { kind: 'board', tier, index: i });
    }
  }
  for (const id of me.reserved) {
    const card = CARD_BY_ID.get(id);
    if (card) push(card, { kind: 'reserved', cardId: id });
  }
  return out;
}

function tokenCandidates(state, me, targets, threats) {
  const room = 10 - tokenTotal(me);
  if (room <= 0) return [];
  const weight = {};
  for (const c of COLORS) weight[c] = 0;

  // 目标卡缺口
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    const mult = i === 0 ? W.targetWeight : W.secondaryTargetWeight;
    const cost = cardCost(t.card, me.bonuses);
    for (const c of COLORS) {
      const miss = Math.max(0, cost[c] - me.tokens[c] - (me.tokens.gold > 0 ? 1 : 0));
      if (miss > 0) weight[c] += miss * mult;
      if (cost[c] > 0) weight[c] += 0.5 * mult;
    }
  }
  // 贵族缺口
  for (const id of state.nobles) {
    const noble = NOBLE_BY_ID.get(id);
    for (const c of COLORS) {
      if ((noble.cost[c] || 0) > (me.bonuses[c] || 0)) weight[c] += W.nobleTokenWeight;
    }
  }
  // 卡位：对手缺的颜色，拿走一部分
  for (const [id, w] of threats) {
    const card = CARD_BY_ID.get(id);
    if (!card) continue;
    const opp = state.players.find((p) => p.id !== me.id && deficitOf(p, card) <= 1);
    if (!opp) continue;
    const cost = cardCost(card, opp.bonuses);
    for (const c of COLORS) {
      if (cost[c] - opp.tokens[c] > 0 && state.tokens[c] > 0) weight[c] += Math.min(1.1, w * W.denyWeight);
    }
  }

  const available = COLORS.filter((c) => state.tokens[c] > 0);
  // 规则要求恰好拿 min(3, 银行可拿色数) 种不同颜色
  const takeCount = Math.min(3, available.length);
  const out = [];
  // 2 枚同色
  for (const c of available) {
    if (state.tokens[c] >= 4 && weight[c] >= 1.4) {
      out.push({ action: { type: 'take', colors: [c, c] }, value: weight[c] * W.doubleTokenBias + 1.2 });
    }
  }
  // 必须恰好拿 min(3, 银行可拿色数) 种不同颜色
  if (takeCount >= 2) {
    const sorted = [...available].sort((a, b) => weight[b] - weight[a]);
    const combos = [];
    const walk = (start, acc) => {
      if (acc.length === takeCount) {
        combos.push([...acc]);
        return;
      }
      for (let i = start; i < sorted.length; i += 1) {
        acc.push(sorted[i]);
        walk(i + 1, acc);
        acc.pop();
      }
    };
    walk(0, []);
    for (const combo of combos) {
      const value = combo.reduce((n, c) => n + weight[c], 0) + combo.length * 0.5;
      out.push({ action: { type: 'take', colors: combo }, value });
    }
  }
  // 去重
  const seen = new Set();
  return out.filter((c) => {
    const key = c.action.colors.slice().sort().join('');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function reserveCandidates(state, me, targets, threats) {
  if (me.reserved.length >= 3) return [];
  const out = [];
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < state.board[tier].length; i += 1) {
      const id = state.board[tier][i];
      if (!id) continue;
      const card = CARD_BY_ID.get(id);
      if (!card) continue;
      if (paymentFor(card, me).affordable) continue;
      const threat = threats.get(id) || 0;
      const worth = card.points * 2.4 + nobleScore(me, state, { [card.bonus]: 1 }) * 0.22;
      const value = worth + threat * 1.6 + (state.tokens.gold > 0 ? 2.2 : 0) + (card.tier === 3 ? 2 : 0);
      if (value > W.reserveThreshold) {
        out.push({ action: { type: 'reserve', source: { kind: 'board', tier, index: i } }, value: value - W.reservePenalty });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 主入口
 * ------------------------------------------------------------------ */

export function chooseBotAction(state, playerId, level = 'normal') {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;

  if (state.phase === 'noble') {
    const options = state.pending.options;
    const best = options
      .map((id) => {
        const n = NOBLE_BY_ID.get(id);
        const overlap = COLORS.reduce((sum, c) => sum + Math.min(me.bonuses[c] || 0, n.cost[c] || 0), 0);
        return { id, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap)[0];
    return best ? { type: 'chooseNoble', nobleId: best.id } : null;
  }

  if (state.phase === 'discard') {
    const need = state.pending.mustReturn;
    const targets = pickTargets(state, me, threatenedCards(state, me), 2);
    const keep = {};
    for (const c of COLORS) keep[c] = 0;
    for (const t of targets) {
      const cost = cardCost(t.card, me.bonuses);
      for (const c of COLORS) keep[c] += Math.max(0, cost[c] - me.tokens[c] + keep[c]);
      for (const c of COLORS) keep[c] = Math.min(keep[c], cost[c]);
    }
    const order = [...COLORS].sort((a, b) => me.tokens[a] - keep[a] - (me.tokens[b] - keep[b]));
    const tokens = {};
    let left = need;
    for (const c of order) {
      if (left <= 0) break;
      const spare = Math.max(0, me.tokens[c] - keep[c]);
      const take = Math.min(left, spare || me.tokens[c]);
      if (take > 0) {
        tokens[c] = take;
        left -= take;
      }
    }
    for (const c of order) {
      if (left <= 0) break;
      const remain = me.tokens[c] - (tokens[c] || 0);
      const take = Math.min(left, remain);
      if (take > 0) {
        tokens[c] = (tokens[c] || 0) + take;
        left -= take;
      }
    }
    if (left > 0 && me.tokens.gold > 0) tokens.gold = Math.min(left, me.tokens.gold);
    return { type: 'returnTokens', tokens };
  }

  if (level === 'easy') return easyAction(state, me);

  const threats = threatenedCards(state, me);
  const targets = pickTargets(state, me, threats, level === 'hard' ? 2 : 1);

  const buys = buyCandidates(state, me, threats);
  if (level === 'normal' && buys.length) {
    buys.sort((a, b) => b.value - a.value);
    return buys[0].action;
  }

  const candidates = [
    ...buys,
    ...reserveCandidates(state, me, targets, threats),
    ...tokenCandidates(state, me, targets, threats),
  ];
  if (candidates.length === 0) {
    const colors = COLORS.filter((c) => state.tokens[c] > 0).slice(0, 3);
    if (colors.length > 0) return { type: 'take', colors };
    // 银行空了：尝试预订任意一张牌，避免卡死
    if (me.reserved.length < 3) {
      for (const tier of [1, 2, 3]) {
        const idx = state.board[tier].findIndex((x) => x);
        if (idx >= 0) return { type: 'reserve', source: { kind: 'board', tier, index: idx } };
      }
    }
    const any = me.reserved.map((id) => ({ id, card: CARD_BY_ID.get(id) })).find((x) => x.card && paymentFor(x.card, me).affordable);
    if (any) return { type: 'buy', source: { kind: 'reserved', cardId: any.id } };
    return null;
  }

  if (level !== 'hard') {
    candidates.sort((a, b) => b.value - a.value);
    return candidates[0].action;
  }

  // 困难：蒙特卡洛推演——对每个候选动作把整局用快速策略打到底，
  // 选最终"我方分数 - 最强对手分数"最高的一手（目标导向 + 对抗性）。
  candidates.sort((a, b) => b.value - a.value);
  const shortlist = candidates.slice(0, 6);
  let best = null;
  let bestScore = -Infinity;
  for (const cand of shortlist) {
    let next = null;
    try {
      next = applyAction(state, playerId, cand.action);
    } catch {
      continue;
    }
    if (!next) continue;
    const score = cand.value * 0.05 + rolloutScore(next, playerId);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return (best || shortlist[0]).action;
}

/** 用快速贪心策略把对局推演到结束，返回我方最终分差 */
export function rolloutScore(state, myId) {
  let s2 = state;
  let guard = 0;
  while (!s2.finished && guard < 600) {
    guard += 1;
    const actor = s2.phase === 'action' ? s2.players[s2.turn]?.id : s2.pending?.playerId;
    if (!actor) break;
    const action = fastAction(s2, actor);
    if (!action) break;
    try {
      s2 = applyAction(s2, actor, action);
    } catch {
      break;
    }
  }
  if (!s2.finished) return evalPosition(s2, myId) * 0.02;
  const mine = s2.players.find((p) => p.id === myId);
  const foes = s2.players.filter((p) => p.id !== myId);
  const topFoe = Math.max(...foes.map((f) => f.points));
  return (mine?.points || 0) * 10 - topFoe * 8;
}

/** 快速策略：不做前瞻，只按启发式取价值最高的一手 */
export function fastAction(state, playerId) {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;
  if (state.phase === 'noble') {
    const options = state.pending.options;
    let bestId = options[0];
    let bestOverlap = -1;
    for (const id of options) {
      const n = NOBLE_BY_ID.get(id);
      const overlap = COLORS.reduce((sum, c) => sum + Math.min(me.bonuses[c] || 0, n.cost[c] || 0), 0);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestId = id;
      }
    }
    return { type: 'chooseNoble', nobleId: bestId };
  }
  if (state.phase === 'discard') {
    const need = state.pending.mustReturn;
    const order = [...COLORS].sort((a, b) => me.tokens[a] - me.tokens[b]);
    const tokens = {};
    let left = need;
    for (const c of order) {
      if (left <= 0) break;
      const take = Math.min(left, me.tokens[c]);
      if (take > 0) {
        tokens[c] = take;
        left -= take;
      }
    }
    return { type: 'returnTokens', tokens };
  }
  const threats = threatenedCards(state, me);
  const targets = pickTargets(state, me, threats, 1);
  const cands = [
    ...buyCandidates(state, me, threats),
    ...reserveCandidates(state, me, targets, threats),
    ...tokenCandidates(state, me, targets, threats),
  ];
  if (!cands.length) {
    const colors = COLORS.filter((c) => state.tokens[c] > 0).slice(0, 3);
    if (colors.length) return { type: 'take', colors };
    if (me.reserved.length < 3) {
      for (const tier of [1, 2, 3]) {
        const i = state.board[tier].findIndex((x) => x);
        if (i >= 0) return { type: 'reserve', source: { kind: 'board', tier, index: i } };
      }
    }
    return null;
  }
  cands.sort((a, b) => b.value - a.value);
  return cands[0].action;
}

/**
 * 简单电脑：只看眼前，不预订、不规划贵族，经常随手拿颜色。
 * 仍然保证动作合法。
 */
function easyAction(state, me) {
  const affordable = [];
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < state.board[tier].length; i += 1) {
      const id = state.board[tier][i];
      if (!id) continue;
      const card = CARD_BY_ID.get(id);
      if (paymentFor(card, me).affordable) affordable.push({ tier, index: i, points: card.points });
    }
  }
  if (affordable.length && Math.random() < 0.6) {
    affordable.sort((a, b) => b.points - a.points);
    const pick = affordable[Math.floor(Math.random() * Math.min(3, affordable.length))];
    return { type: 'buy', source: { kind: 'board', tier: pick.tier, index: pick.index } };
  }
  const colors = COLORS.filter((c) => state.tokens[c] > 0);
  if (colors.length === 0) {
    const goldCard = me.reserved.map((id) => ({ id, card: CARD_BY_ID.get(id) })).find((x) => x.card && paymentFor(x.card, me).affordable);
    if (goldCard) return { type: 'buy', source: { kind: 'reserved', cardId: goldCard.id } };
    if (me.reserved.length < 3) {
      for (const tier of [1, 2, 3]) {
        const idx = state.board[tier].findIndex((x) => x);
        if (idx >= 0) return { type: 'reserve', source: { kind: 'board', tier, index: idx } };
      }
    }
    return null;
  }
  const shuffled = [...colors].sort(() => Math.random() - 0.5);
  if (Math.random() < 0.25) {
    const c = shuffled.find((x) => state.tokens[x] >= 4);
    if (c) return { type: 'take', colors: [c, c] };
  }
  return { type: 'take', colors: shuffled.slice(0, Math.min(3, shuffled.length)) };
}

export function simulateGame(playersCount = 2, seed = 1) {
  return { playersCount, seed };
}


/* ------------------------------------------------------------------ *
 * 合法动作枚举（供神经网络推理复用）
 * ------------------------------------------------------------------ */

/**
 * 列出当前行动者的全部合法动作。
 * 与 chooseBotAction 内部的候选项同源，只是不做打分。
 */
export function listLegalActions(state, playerId) {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return [];

  if (state.phase === 'noble') {
    return state.pending.options.map((id) => ({ type: 'chooseNoble', nobleId: id }));
  }
  if (state.phase === 'discard') {
    const need = state.pending.mustReturn;
    const order = [...COLORS].sort((a, b) => me.tokens[a] - me.tokens[b]);
    const tokens = {};
    let left = need;
    for (const c of order) {
      if (left <= 0) break;
      const take = Math.min(left, me.tokens[c]);
      if (take > 0) {
        tokens[c] = take;
        left -= take;
      }
    }
    if (left > 0 && me.tokens.gold > 0) tokens.gold = Math.min(left, me.tokens.gold);
    return [{ type: 'returnTokens', tokens }];
  }

  const threats = threatenedCards(state, me);
  const targets = pickTargets(state, me, threats, 1);
  const candidates = [
    ...buyCandidates(state, me, threats),
    ...reserveCandidates(state, me, targets, threats),
    ...tokenCandidates(state, me, targets, threats),
  ];
  return candidates.map((c) => c.action);
}
