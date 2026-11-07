import { createGame, applyAction } from '../shared/rules.mjs';
import { chooseBotAction } from '../shared/bot.mjs';

// 用法：node scripts/duel.mjs [局数] [对手难度]
const games = Number(process.argv[2]) || 60;
const opponent = process.argv[3] || 'easy';

const LEVELS = ['easy', 'normal', 'hard'];
const results = { win: 0, lose: 0, draw: 0, turns: 0, errors: 0, avgScore: 0 };

for (let g = 0; g < games; g += 1) {
  const players = [
    { id: 'hero', name: '测试者', isBot: true, botLevel: 'hard' },
    { id: 'foe', name: '对手', isBot: true, botLevel: opponent },
  ];
  let state = createGame({ players, seed: `duel-${opponent}-${g}`, startPlayer: g % 2 });
  let guard = 0;
  while (!state.finished && guard < 3000) {
    guard += 1;
    const actor = state.phase === 'action' ? state.players[state.turn].id : state.pending?.playerId;
    const lvl = state.players.find((p) => p.id === actor)?.botLevel || 'normal';
    const action = chooseBotAction(state, actor, lvl);
    if (!action) {
      results.errors += 1;
      break;
    }
    try {
      state = applyAction(state, actor, action);
    } catch (err) {
      results.errors += 1;
      console.error(`game ${g} move ${guard}: ${err.message}`, JSON.stringify(action));
      break;
    }
  }
  if (!state.finished) continue;
  results.turns += state.turnCount;
  results.avgScore += state.players.find((p) => p.id === 'hero').points;
  if (state.winners.includes('hero')) results.win += 1;
  else if (state.winners.includes('foe')) results.lose += 1;
  else results.draw += 1;
}

const total = results.win + results.lose + results.draw;
console.log(`难度 ${opponent} vs hard：${games} 局`);
console.log(`胜 ${results.win} / 负 ${results.lose} / 平 ${results.draw}  → 胜率 ${((results.win / Math.max(1, total)) * 100).toFixed(1)}%`);
console.log(`平均回合 ${(results.turns / Math.max(1, total)).toFixed(1)}，测试者平均 ${(results.avgScore / Math.max(1, total)).toFixed(1)} 分，错误 ${results.errors}`);
