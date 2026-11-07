import { createGame, applyAction } from '../shared/rules.mjs';
import { chooseBotAction } from '../shared/bot.mjs';
import { chooseNnAction, nnInsight, nnAvailable } from '../shared/nn-bot.mjs';
import { listAllActions } from '../shared/actions.mjs';

nnAvailable();
const players = [
  { id: 'nn', name: 'NN', isBot: true, botLevel: 'hard' },
  { id: 'bot', name: 'BOT', isBot: true, botLevel: 'normal' },
];
let state = createGame({ players, seed: 'diag-1' });
let guard = 0;
const kinds = { take: 0, buy: 0, reserve: 0, chooseNoble: 0, returnTokens: 0 };

while (!state.finished && guard < 400) {
  guard += 1;
  const actor = state.phase === 'action' ? state.players[state.turn].id : state.pending?.playerId;
  if (!actor) break;
  let action;
  if (actor === 'nn') {
    action = chooseNnAction(state, actor, { search: true });
    if (!action) {
      const acts = listAllActions(state, actor);
      action = acts[0];
      console.log('NN fallback, legal', acts.length);
    }
    kinds[action.type] = (kinds[action.type] || 0) + 1;
  } else {
    action = chooseBotAction(state, actor, 'normal');
    if (!action) {
      const acts = listAllActions(state, actor);
      console.log('BOT returned null at phase', state.phase, 'legal', acts.length, JSON.stringify(acts.slice(0, 2)));
      action = acts[0];
      if (!action) break;
    }
  }
  try {
    state = applyAction(state, actor, action);
  } catch (e) {
    console.log('illegal', e.message, JSON.stringify(action), 'phase', state.phase);
    break;
  }
}
console.log('finished', state.finished, 'points', state.players.map((p) => `${p.id}:${p.points}`).join(' '), 'kinds', kinds);
