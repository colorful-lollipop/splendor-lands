/**
 * 用随机权重冒烟测试 JS 端前向推理，确认张量形状与 Python 侧一致。
 * 不依赖 torch：随机初始化同形状权重即可跑通整条链路。
 */
import fs from 'node:fs';
import { loadNnWeights, nnEvaluate } from '../shared/nn.mjs';
import { createGame, listActionsOf } from './_tmp_helpers.mjs';

const D = 96;
const FF = D * 4;
const rand = (n, scale = 0.05) => Array.from({ length: n }, () => (Math.random() * 2 - 1) * scale);

function linear(out, inp) {
  return { shape: [out, inp], data: rand(out * inp) };
}
function bias(n) {
  return { shape: [n], data: rand(n, 0.01) };
}
function norm(n) {
  return { shape: [n], data: new Array(n).fill(1) };
}

const tensors = {
  'card_in.weight': linear(D, 16),
  'card_in.bias': bias(D),
  'noble_in.weight': linear(D, 12),
  'noble_in.bias': bias(D),
  'player_in.weight': linear(D, 18),
  'player_in.bias': bias(D),
  'global_in.weight': linear(D, 12),
  'global_in.bias': bias(D),
  'type_emb.weight': linear(4, D),
  'pos_emb.weight': linear(22, D),
  pool_query: { shape: [1, 1, D], data: rand(D, 0.02) },
  goal_query: { shape: [1, 1, D], data: rand(D, 0.02) },
  'goal_proj.0.weight': linear(D, D),
  'goal_proj.0.bias': bias(D),
  'goal_proj.2.weight': linear(D, D),
  'goal_proj.2.bias': bias(D),
  'act_in.weight': linear(D, 40),
  'act_in.bias': bias(D),
  'act_mlp.0.weight': linear(D * 2, D),
  'act_mlp.0.bias': bias(D * 2),
  'act_mlp.2.weight': linear(D, D * 2),
  'act_mlp.2.bias': bias(D),
  'act_norm.weight': norm(D),
  'act_norm.bias': bias(D),
  'value_head.0.weight': linear(D, D * 2),
  'value_head.0.bias': bias(D),
  'value_head.2.weight': linear(1, D),
  'value_head.2.bias': bias(1),
  'intent_proj.0.weight': linear(D, D * 2),
  'intent_proj.0.bias': bias(D),
  'intent_proj.2.weight': linear(8, D),
  'intent_proj.2.bias': bias(8),
};

for (const side of ['pool_attn', 'goal_attn']) {
  tensors[`${side}.in_proj_weight`] = { shape: [D * 3, D], data: rand(D * 3 * D) };
  tensors[`${side}.in_proj_bias`] = bias(D * 3);
  tensors[`${side}.out_proj.weight`] = linear(D, D);
  tensors[`${side}.out_proj.bias`] = bias(D);
}

for (let l = 0; l < 3; l += 1) {
  const p = `encoder.layers.${l}`;
  tensors[`${p}.norm1.weight`] = norm(D);
  tensors[`${p}.norm1.bias`] = bias(D);
  tensors[`${p}.norm2.weight`] = norm(D);
  tensors[`${p}.norm2.bias`] = bias(D);
  tensors[`${p}.self_attn.in_proj_weight`] = { shape: [D * 3, D], data: rand(D * 3 * D) };
  tensors[`${p}.self_attn.in_proj_bias`] = bias(D * 3);
  tensors[`${p}.self_attn.out_proj.weight`] = linear(D, D);
  tensors[`${p}.self_attn.out_proj.bias`] = bias(D);
  tensors[`${p}.linear1.weight`] = linear(FF, D);
  tensors[`${p}.linear1.bias`] = bias(FF);
  tensors[`${p}.linear2.weight`] = linear(D, FF);
  tensors[`${p}.linear2.bias`] = bias(D);
}

loadNnWeights({ config: { d_model: D, max_actions: 96 }, tensors });

const { encodeState, encodeActions } = await import('../shared/nn-features.mjs');
const state = createGame({ players: [{ id: 'a', name: 'A', isBot: true }, { id: 'b', name: 'B', isBot: true }], seed: 'smoke' });
const actions = listActionsOf(state, state.players[state.turn].id);
const { cards, nobles, players, glob } = encodeState(state, state.players[state.turn].seat);
const { actions: av, mask } = encodeActions(state, actions, state.players[state.turn].seat);

globalThis.__NN_DEBUG = true;
const t0 = Date.now();
const out = nnEvaluate({ cards, nobles, players, glob, actions: av, mask });
const dt = Date.now() - t0;
console.log('actions', actions.length, 'best', out.best, 'value', out.value.toFixed(4), 'ms', dt);
console.log('probs sum', [...out.probs].reduce((a, b) => a + b, 0).toFixed(4));
console.log('intent', [...out.intent].map((x) => x.toFixed(2)).join(','));
