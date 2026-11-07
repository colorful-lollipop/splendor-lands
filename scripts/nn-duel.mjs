/**
 * 神经网络 vs 启发式的对局测试。
 * 用法：node scripts/nn-duel.mjs [局数] [对手难度]
 */
import { createGame, applyAction } from '../shared/rules.mjs';
import { chooseBotAction } from '../shared/bot.mjs';
import { chooseNnAction, nnAvailable } from '../shared/nn-bot.mjs';

const games = Number(process.argv[2]) || 20;
const foeLevel = process.argv[3] || 'normal';

if (!nnAvailable()) {
  console.log('没有 nn-weights.json，跳过');
  process.exit(0);
}

let win = 0;
let lose = 0;
let draw = 0;
let errs = 0;
let nnTime = 0;
let nnMoves = 0;

for (let g = 0; g < games; g += 1) {
  const players = [
    { id: 'nn', name: '神经网络', isBot: true, botLevel: 'hard' },
    { id: 'bot', name: '启发式', isBot: true, botLevel: foeLevel },
  ];
  let state = createGame({ players, seed: `nnduel-${g}`, startPlayer: g % 2 });
  let guard = 0;
  while (!state.finished && guard < 2000) {
    guard += 1;
    const actor = state.phase === 'action' ? state.players[state.turn].id : state.pending?.playerId;
    if (!actor) break;
    let action = null;
    if (actor === 'nn') {
      const t0 = Date.now();
      action = chooseNnAction(state, actor, { search: true });
      nnTime += Date.now() - t0;
      nnMoves += 1;
      if (!action) action = chooseBotAction(state, actor, 'hard');
    } else {
      action = chooseBotAction(state, actor, foeLevel);
    }
    if (!action) break;
    try {
      state = applyAction(state, actor, action);
    } catch (e) {
      errs += 1;
      break;
    }
  }
  if (!state.finished) continue;
  if (state.winners.includes('nn')) win += 1;
  else if (state.winners.includes('bot')) lose += 1;
  else draw += 1;
}

const total = win + lose + draw;
console.log(`神经网络 vs ${foeLevel}：${total}/${games} 局完成`);
console.log(`胜 ${win} / 负 ${lose} / 平 ${draw} → 胜率 ${((win / Math.max(1, total)) * 100).toFixed(1)}%`);
console.log(`平均每步推理 ${(nnTime / Math.max(1, nnMoves)).toFixed(1)} ms，非法动作 ${errs}`);
