/**
 * 生成"行为克隆"训练集：让强启发式（hard）自对弈，记录每一步的局面与决策。
 *
 * 输出 train/data/imitation.jsonl，每行：
 *   { seat, action, intent, finalPoints, won, state }
 *
 * 用法：node scripts/gen-imitation.mjs [局数]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createGame, applyAction } from '../shared/rules.mjs';
import { chooseBotAction, listLegalActions } from '../shared/bot.mjs';

const GAMES = Number(process.argv[2]) || 200;
const LEVEL = process.argv[3] || 'hard';
const OUT_DIR = 'train/data';
const OUT = path.join(OUT_DIR, 'imitation.jsonl');

fs.mkdirSync(OUT_DIR, { recursive: true });
const stream = fs.createWriteStream(OUT, { encoding: 'utf8' });

let total = 0;
let finished = 0;

const intentOf = (state, seat, action) => {
  const me = state.players[seat];
  if (action.type === 'take') return 1;
  if (action.type === 'reserve') return 4;
  if (action.type === 'buy') {
    const src = action.source;
    const cid = src.kind === 'board' ? state.board[src.tier][src.index] : src.cardId;
    if (!cid) return 3;
    const card = CARD_POINTS[cid] >= 3 ? 0 : null;
    if (card !== null) return card;
    return 2;
  }
  return 3;
};

// 从 cards.json 取声望表，避免依赖 rules 内部结构
const CARDS = JSON.parse(fs.readFileSync('shared/cards.json', 'utf8'));
const POINTS = new Map(CARDS.map((c) => [c.id, c.points]));
const CARD_POINTS = { get: (id) => POINTS.get(id) ?? 0 };

function slimState(state) {
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      tokens: p.tokens,
      bonuses: p.bonuses,
      cards: p.cards,
      reserved: p.reserved,
      nobles: p.nobles,
      points: p.points,
    })),
    board: state.board,
    decks: state.decks,
    nobles: state.nobles,
    tokens: state.tokens,
    turn: state.turn,
    phase: state.phase,
    pending: state.pending,
    turnCount: state.turnCount,
    round: state.round,
    endTriggered: state.endTriggered,
  };
}

for (let g = 0; g < GAMES; g += 1) {
  const n = 2 + (g % 3);
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isBot: true }));
  let state = createGame({ players, seed: `imit-${g}` });
  const log = [];
  let guard = 0;

  while (!state.finished && guard < 1500) {
    guard += 1;
    const actor = state.phase === 'action' ? state.players[state.turn].id : state.pending?.playerId;
    if (!actor) break;
    const seat = state.players.find((p) => p.id === actor).seat;
    const legal = listLegalActions(state, actor);
    if (!legal.length) break;
    const action = chooseBotAction(state, actor, LEVEL);
    if (!action) break;

    if (state.phase === 'action') {
      log.push({ seat, action, intent: intentOf(state, seat, action), snap: slimState(state), playerId: actor });
    }

    try {
      state = applyAction(state, actor, action);
    } catch {
      break;
    }
  }

  if (!state.finished) continue;
  finished += 1;
  const best = Math.max(...state.players.map((p) => p.points));

  for (const rec of log) {
    const pl = state.players.find((p) => p.id === rec.playerId);
    const line = JSON.stringify({
      seat: rec.seat,
      action: rec.action,
      intent: rec.intent,
      finalPoints: pl?.points ?? 0,
      bestPoints: best,
      won: state.winners.includes(rec.playerId) ? 1 : 0,
      state: rec.snap,
    });
    stream.write(`${line}\n`);
    total += 1;
  }
}

stream.end();
stream.on('finish', () => {
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`完成 ${finished} 局，样本 ${total} 条，${OUT} (${mb} MB)`);
});
