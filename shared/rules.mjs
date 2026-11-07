import { CARDS, NOBLES } from './data.mjs';

/** @typedef {'w'|'b'|'g'|'r'|'k'} Color */
/** @typedef {Color|'gold'} TokenColor */

export const COLORS = /** @type {Color[]} */ (['w', 'b', 'g', 'r', 'k']);

export const GEM_INFO = {
  w: { name: '钻石', en: 'Diamond', hex: '#e8e2d0' },
  b: { name: '蓝宝石', en: 'Sapphire', hex: '#3b7dd8' },
  g: { name: '祖母绿', en: 'Emerald', hex: '#2fa66a' },
  r: { name: '红宝石', en: 'Ruby', hex: '#c8353d' },
  k: { name: '黑曜石', en: 'Onyx', hex: '#3b3644' },
  gold: { name: '黄金', en: 'Gold', hex: '#e0a63a' },
};

export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
export const NOBLE_BY_ID = new Map(NOBLES.map((n) => [n.id, n]));

export class RuleError extends Error {}

const emptyTokens = () => ({ w: 0, b: 0, g: 0, r: 0, k: 0, gold: 0 });
const emptyBonuses = () => ({ w: 0, b: 0, g: 0, r: 0, k: 0 });

function hashSeed(seed) {
  let h = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = hashSeed(seed);
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const TOKEN_SUPPLY_BY_PLAYERS = { 2: 4, 3: 5, 4: 7 };

export function createGame({ players, seed = Date.now(), startPlayer = 0 }) {
  if (players.length < 2 || players.length > 4) throw new RuleError('游戏需要 2 至 4 名玩家');
  const rng = makeRng(seed);
  const decks = { 1: [], 2: [], 3: [] };
  for (const card of CARDS) decks[card.tier].push(card.id);
  for (const tier of [1, 2, 3]) decks[tier] = shuffle(decks[tier], rng);

  const board = { 1: [], 2: [], 3: [] };
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < 4; i++) board[tier].push(decks[tier].shift() ?? null);
  }

  const perColor = TOKEN_SUPPLY_BY_PLAYERS[players.length] ?? 7;
  const tokens = { w: perColor, b: perColor, g: perColor, r: perColor, k: perColor, gold: 5 };
  const noblePool = shuffle(NOBLES.map((n) => n.id), rng);
  const nobles = noblePool.slice(0, players.length + 1);

  const state = {
    seed,
    playerCount: players.length,
    decks,
    board,
    nobles,
    tokens,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isBot: Boolean(p.isBot),
      avatar: p.avatar || 'w1',
      botLevel: p.botLevel || 'normal',
      seat: i,
      tokens: emptyTokens(),
      bonuses: emptyBonuses(),
      cards: [],
      reserved: [],
      nobles: [],
      points: 0,
      connected: p.connected !== false,
    })),
    turn: startPlayer % players.length,
    startPlayer: startPlayer % players.length,
    phase: 'action',
    pending: null,
    turnCount: 0,
    round: 1,
    endTriggered: false,
    finished: false,
    winners: [],
    log: [],
    lastAction: null,
    createdAt: Date.now(),
  };

  pushLog(state, null, `游戏开始 · ${players.length} 位远征商人入席`, 'system');
  return state;
}

let logSeq = 0;
export function pushLog(state, playerId, text, kind = 'info') {
  const entry = { id: `log-${Date.now()}-${logSeq++}`, playerId, text, kind, at: Date.now() };
  state.log.push(entry);
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
  return entry;
}

export function currentPlayer(state) {
  return state.players[state.turn];
}

export function cardCost(card, bonuses) {
  const cost = {};
  for (const c of COLORS) cost[c] = Math.max(0, (card.cost[c] || 0) - (bonuses[c] || 0));
  return cost;
}

export function paymentFor(card, player) {
  const cost = cardCost(card, player.bonuses);
  const pay = emptyTokens();
  let goldNeeded = 0;
  for (const c of COLORS) {
    const have = player.tokens[c];
    const use = Math.min(have, cost[c]);
    pay[c] = use;
    goldNeeded += cost[c] - use;
  }
  pay.gold = goldNeeded;
  return { cost, pay, goldNeeded, affordable: goldNeeded <= player.tokens.gold };
}

export function canAfford(card, player) {
  return paymentFor(card, player).affordable;
}

function tokenTotal(tokens) {
  return COLORS.reduce((n, c) => n + (tokens[c] || 0), 0) + (tokens.gold || 0);
}

function removeTokens(bank, tokens, sign = -1) {
  for (const c of [...COLORS, 'gold']) {
    bank[c] += sign * (tokens[c] || 0);
    if (bank[c] < 0) throw new RuleError('宝石供应不足');
  }
}

function cardName(card) {
  return card.name || `${GEM_INFO[card.bonus].name}卡`;
}

function refillBoard(state, tier) {
  const row = state.board[tier];
  for (let i = 0; i < row.length; i++) {
    if (row[i]) continue;
    row[i] = state.decks[tier].shift() ?? null;
    if (row[i]) return;
  }
}

export function eligibleNobles(state, player) {
  return state.nobles.filter((id) => {
    const n = NOBLE_BY_ID.get(id);
    return COLORS.every((c) => (player.bonuses[c] || 0) >= (n.cost[c] || 0));
  });
}

function grantNoble(state, player, nobleId) {
  const idx = state.nobles.indexOf(nobleId);
  if (idx === -1) throw new RuleError('该贵族已离开牌桌');
  state.nobles.splice(idx, 1);
  player.nobles.push(nobleId);
  player.points += NOBLE_BY_ID.get(nobleId).points;
  pushLog(state, player.id, `${player.name} 获得了「${NOBLE_BY_ID.get(nobleId).name}」的青睐（+3 声望）`, 'noble');
}

function updateEndTriggered(state) {
  if (state.players.some((p) => p.points >= 15)) state.endTriggered = true;
}

/** 结算贵族拜访；若有多位候选则进入选择阶段。返回是否阻塞 */
function settleNobles(state, player) {
  const options = eligibleNobles(state, player);
  if (options.length === 0) return false;
  if (options.length === 1) {
    grantNoble(state, player, options[0]);
    updateEndTriggered(state);
    return false;
  }
  state.phase = 'noble';
  state.pending = { type: 'noble', playerId: player.id, options };
  pushLog(state, player.id, `${player.name} 可以迎接一位贵族，正在挑选…`, 'info');
  return true;
}

function settleDiscard(state, player) {
  if (tokenTotal(player.tokens) > 10) {
    state.phase = 'discard';
    state.pending = { type: 'discard', playerId: player.id, mustReturn: tokenTotal(player.tokens) - 10 };
    pushLog(state, player.id, `${player.name} 拥有的宝石超过 10 枚，需要归还 ${tokenTotal(player.tokens) - 10} 枚`, 'info');
    return true;
  }
  return false;
}

function finishTurn(state) {
  const player = currentPlayer(state);
  state.turnCount += 1;
  state.lastAction = null;
  state.pending = null;
  state.phase = 'action';

  const next = (state.turn + 1) % state.players.length;
  if (state.endTriggered && next === state.startPlayer) {
    finishGame(state);
    return;
  }
  if (next === state.startPlayer) state.round += 1;
  state.turn = next;
  const nextPlayer = currentPlayer(state);
  pushLog(state, nextPlayer.id, `轮到 ${nextPlayer.name} 行动`, 'turn');
}

function finishGame(state) {
  state.finished = true;
  state.phase = 'finished';
  state.pending = null;
  const best = state.players.reduce((max, p) => Math.max(max, p.points), -Infinity);
  const contenders = state.players.filter((p) => p.points === best);
  const leastCards = Math.min(...contenders.map((p) => p.cards.length));
  state.winners = contenders.filter((p) => p.cards.length === leastCards).map((p) => p.id);
  const names = state.players.filter((p) => state.winners.includes(p.id)).map((p) => p.name);
  pushLog(state, null, `游戏结束 · ${names.join('、')} 以 ${best} 声望赢得胜利！`, 'end');
}

function assertTurn(state, playerId) {
  if (state.finished) throw new RuleError('游戏已经结束');
  const player = state.players[state.turn];
  if (player.id !== playerId) throw new RuleError('还没有轮到你行动');
  return player;
}

function logAction(state, player, text) {
  state.lastAction = { playerId: player.id, text, at: Date.now() };
  pushLog(state, player.id, text, 'action');
}

function takeTokens(state, player, colors) {
  if (!Array.isArray(colors) || colors.length === 0) throw new RuleError('请选择要拿取的宝石');
  if (colors.some((c) => !COLORS.includes(c))) throw new RuleError('宝石颜色无效');
  const unique = new Set(colors);
  if (colors.length === 2 && unique.size === 1) {
    const c = colors[0];
    if (state.tokens[c] < 4) throw new RuleError('该颜色的宝石不足 4 枚，不能拿取两枚同色宝石');
    state.tokens[c] -= 2;
    player.tokens[c] += 2;
    logAction(state, player, `${player.name} 拿取了 2 枚${GEM_INFO[c].name}`);
    return;
  }
  if (colors.length > 3 || unique.size !== colors.length) {
    throw new RuleError('一次最多拿取 3 枚不同颜色的宝石');
  }
  const available = COLORS.filter((c) => state.tokens[c] > 0);
  const expected = Math.min(3, available.length);
  if (colors.length !== expected) {
    throw new RuleError(`当前应拿取 ${expected} 枚不同颜色的宝石`);
  }
  for (const c of colors) {
    if (state.tokens[c] < 1) throw new RuleError(`${GEM_INFO[c].name}已经耗尽`);
  }
  for (const c of colors) {
    state.tokens[c] -= 1;
    player.tokens[c] += 1;
  }
  const names = colors.map((c) => GEM_INFO[c].name).join('、');
  logAction(state, player, `${player.name} 拿取了 ${names}`);
}

function reserveCard(state, player, source) {
  if (player.reserved.length >= 3) throw new RuleError('最多只能保留 3 张卡牌');
  let cardId;
  if (source.kind === 'board') {
    const { tier, index } = source;
    if (!state.board[tier] || index < 0 || index >= state.board[tier].length) throw new RuleError('卡牌位置无效');
    cardId = state.board[tier][index];
    if (!cardId) throw new RuleError('这里没有卡牌');
    state.board[tier][index] = null;
    refillBoard(state, tier);
  } else if (source.kind === 'deck') {
    const { tier } = source;
    if (!state.decks[tier]?.length) throw new RuleError('该等级牌堆已经空了');
    cardId = state.decks[tier].shift();
  } else {
    throw new RuleError('预订来源无效');
  }
  player.reserved.push(cardId);
  let goldText = '';
  if (state.tokens.gold > 0) {
    state.tokens.gold -= 1;
    player.tokens.gold += 1;
    goldText = '，并获得 1 枚黄金';
  }
  const card = CARD_BY_ID.get(cardId);
  logAction(state, player, `${player.name} 预订了一张${GEM_INFO[card.bonus].name}卡${goldText}`);
}

function buyCard(state, player, source) {
  let cardId;
  let fromReserved = false;
  if (source.kind === 'board') {
    const { tier, index } = source;
    if (!state.board[tier] || index < 0 || index >= state.board[tier].length) throw new RuleError('卡牌位置无效');
    cardId = state.board[tier][index];
    if (!cardId) throw new RuleError('这里没有卡牌');
  } else if (source.kind === 'reserved') {
    cardId = source.cardId;
    if (!player.reserved.includes(cardId)) throw new RuleError('你没有保留这张卡');
    fromReserved = true;
  } else {
    throw new RuleError('购买来源无效');
  }
  const card = CARD_BY_ID.get(cardId);
  const payment = paymentFor(card, player);
  if (!payment.affordable) {
    throw new RuleError(`宝石不足，还需要 ${payment.goldNeeded - player.tokens.gold} 枚黄金或等值宝石`);
  }

  for (const c of COLORS) {
    player.tokens[c] -= payment.pay[c];
    state.tokens[c] += payment.pay[c];
  }
  player.tokens.gold -= payment.pay.gold;
  state.tokens.gold += payment.pay.gold;

  if (fromReserved) {
    player.reserved.splice(player.reserved.indexOf(cardId), 1);
  } else {
    const { tier, index } = source;
    state.board[tier][index] = null;
    refillBoard(state, tier);
  }

  player.cards.push(cardId);
  player.bonuses[card.bonus] += 1;
  player.points += card.points;

  const paid = [...COLORS, 'gold']
    .filter((c) => payment.pay[c] > 0)
    .map((c) => `${payment.pay[c]}${GEM_INFO[c].name}`)
    .join(' ');
  logAction(state, player, `${player.name} 购入了「${cardName(card)}」${card.points ? `（+${card.points} 声望）` : ''}${paid ? `，支付 ${paid}` : ''}`);
  if (card.points) updateEndTriggered(state);
}

function chooseNoble(state, player, nobleId) {
  if (state.phase !== 'noble' || state.pending?.playerId !== player.id) throw new RuleError('现在不能选择贵族');
  if (!state.pending.options.includes(nobleId)) throw new RuleError('你不能迎接这位贵族');
  grantNoble(state, player, nobleId);
  state.phase = 'action';
  state.pending = null;
  updateEndTriggered(state);
  if (settleDiscard(state, player)) return;
  finishTurn(state);
}

function returnTokens(state, player, tokens) {
  if (state.phase !== 'discard' || state.pending?.playerId !== player.id) throw new RuleError('现在不能归还宝石');
  const need = state.pending.mustReturn;
  let returned = 0;
  for (const c of [...COLORS, 'gold']) {
    const n = Math.max(0, Math.min(Number(tokens[c]) || 0, player.tokens[c]));
    player.tokens[c] -= n;
    state.tokens[c] += n;
    returned += n;
  }
  if (returned !== need) throw new RuleError(`需要归还正好 ${need} 枚宝石`);
  pushLog(state, player.id, `${player.name} 归还了 ${returned} 枚宝石`, 'info');
  state.pending = null;
  state.phase = 'action';
  finishTurn(state);
}

/** 当前玩家的合法动作列表（用于提示 / 机器人） */
export function describeTurn(state) {
  const player = currentPlayer(state);
  if (!player) return '';
  if (state.phase === 'noble') return `${player.name} 正在选择贵族`;
  if (state.phase === 'discard') return `${player.name} 正在归还宝石`;
  return `${player.name} 的回合`;
}

/**
 * 执行一个动作。会在状态副本上执行，成功返回新状态。 * action: {type:'take', colors} | {type:'reserve', source} | {type:'buy', source} | {type:'chooseNoble', nobleId} | {type:'returnTokens', tokens}
 */
export function applyAction(prev, playerId, action) {
  const state = JSON.parse(JSON.stringify(prev));
  const player = assertTurn(state, playerId);

  if (state.phase === 'noble') {
    if (action.type !== 'chooseNoble') throw new RuleError('请先选择要迎接的贵族');
    chooseNoble(state, player, action.nobleId);
    return state;
  }
  if (state.phase === 'discard') {
    if (action.type !== 'returnTokens') throw new RuleError('请先归还多余的宝石');
    returnTokens(state, player, action.tokens || {});
    return state;
  }
  if (state.finished) throw new RuleError('游戏已经结束');

  switch (action.type) {
    case 'take':
      takeTokens(state, player, action.colors);
      break;
    case 'reserve':
      reserveCard(state, player, action.source || {});
      break;
    case 'buy':
      buyCard(state, player, action.source || {});
      break;
    default:
      throw new RuleError('未知动作');
  }

  if (settleNobles(state, player)) return state;
  if (settleDiscard(state, player)) return state;
  finishTurn(state);
  return state;
}

export function publicPlayers(state, viewerId) {
  return state.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar || 'w1',
    botLevel: p.botLevel || 'normal',
    seat: p.seat,
    isBot: p.isBot,
    connected: p.connected,
    points: p.points,
    tokens: { ...p.tokens },
    bonuses: { ...p.bonuses },
    cards: [...p.cards],
    cardCount: p.cards.length,
    nobles: [...p.nobles],
    reserved: p.id === viewerId ? [...p.reserved] : [],
    reservedCount: p.reserved.length,
    reservedHidden: p.id !== viewerId ? p.reserved.map((id) => ({ tier: CARD_BY_ID.get(id).tier })) : [],
  }));
}

export function sanitizeState(state, viewerId) {
  const me = state.players.find((p) => p.id === viewerId);
  return {
    seed: state.seed,
    playerCount: state.playerCount,
    decks: { 1: state.decks[1].length, 2: state.decks[2].length, 3: state.decks[3].length },
    board: state.board,
    nobles: state.nobles,
    tokens: { ...state.tokens },
    players: publicPlayers(state, viewerId),
    turn: state.players[state.turn]?.id ?? null,
    startPlayerId: state.players[state.startPlayer]?.id ?? null,
    phase: state.phase,
    pending: state.pending && state.pending.playerId === viewerId ? state.pending : state.pending ? { type: state.pending.type, playerId: state.pending.playerId } : null,
    turnCount: state.turnCount,
    round: state.round,
    endTriggered: state.endTriggered,
    finished: state.finished,
    winners: [...state.winners],
    log: state.log.slice(-60),
    lastAction: state.lastAction,
    createdAt: state.createdAt,
    you: me ? { id: me.id, seat: me.seat } : null,
    canAct:
      !state.finished &&
      ((state.phase === 'action' && state.players[state.turn]?.id === viewerId) ||
        (state.phase === 'noble' && state.pending?.playerId === viewerId) ||
        (state.phase === 'discard' && state.pending?.playerId === viewerId)),
  };
}
