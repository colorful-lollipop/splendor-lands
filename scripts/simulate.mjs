import { COLORS, TOKEN_SUPPLY_BY_PLAYERS, createGame, applyAction, sanitizeState } from '../shared/rules.mjs';
import { chooseBotAction } from '../shared/bot.mjs';

const games = Number(process.argv[2]) || 200;
const playersCount = Number(process.argv[3]) || 4;

let finished = 0;
let totalTurns = 0;
let maxTurns = 0;
let errors = 0;
const scoreBuckets = [];
const winnerScores = [];

for (let g = 0; g < games; g++) {
  const players = Array.from({ length: playersCount }, (_, i) => ({ id: `p${i}`, name: `商人${i + 1}`, isBot: true }));
  let state = createGame({ players, seed: `sim-${g}` });
  let guard = 0;
  while (!state.finished && guard < 4000) {
    guard++;
    const actor = state.phase === 'action' ? state.players[state.turn].id : state.pending?.playerId;
    const action = chooseBotAction(state, actor);
    if (!action) {
      errors++;
      break;
    }
    try {
      state = applyAction(state, actor, action);
      // 官方总供应守恒：银行 + 所有玩家手中，普通宝石每色固定，黄金始终为 5。
      for (const color of [...COLORS, 'gold']) {
        const expected = color === 'gold' ? 5 : TOKEN_SUPPLY_BY_PLAYERS[playersCount];
        const actual = state.tokens[color] + state.players.reduce((sum, player) => sum + player.tokens[color], 0);
        if (actual !== expected || state.tokens[color] < 0) {
          throw new Error(`${color} 宝石数量不守恒：应为 ${expected}，实际 ${actual}`);
        }
      }
    } catch (err) {
      errors++;
      console.error(`game ${g} turn ${guard}: ${err.message}`, JSON.stringify(action));
      break;
    }
  }
  if (state.finished) {
    finished++;
    totalTurns += state.turnCount;
    maxTurns = Math.max(maxTurns, state.turnCount);
    scoreBuckets.push(...state.players.map((p) => p.points));
    winnerScores.push(Math.max(...state.players.map((p) => p.points)));
    if (g === 0) {
      const view = sanitizeState(state, 'p0');
      console.log('sample finished, winners:', state.winners, 'log tail:', view.log.slice(-4).map((l) => l.text));
    }
  } else {
    errors++;
    console.log(`game ${g} did not finish in ${guard} steps (phase=${state.phase})`);
  }
}

const avg = (a) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2);
console.log(`games=${games} players=${playersCount} finished=${finished} errors=${errors}`);
console.log(`avg turns=${avg([totalTurns / Math.max(1, finished)])} maxTurns=${maxTurns}`);
console.log(`avg final score=${avg(scoreBuckets)} avg winner score=${avg(winnerScores)}`);
