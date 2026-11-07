/**
 * 神经网络对手（由 train/ 里的 PyTorch 训练得到）。
 *
 * 服务器启动时尝试加载 `shared/nn-weights.json`；
 * 若不存在或推理出错，自动回退到启发式机器人（shared/bot.mjs）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAction } from './rules.mjs';
import { listAllActions } from './actions.mjs';
import { rolloutScore, listLegalActions } from './bot.mjs';
import { encodeState, encodeActions } from './nn-features.mjs';
import { loadNnWeights, nnReady, nnEvaluate } from './nn.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEIGHTS_PATH = path.join(HERE, 'nn-weights.json');

let loaded = false;

export function ensureNnLoaded() {
  if (loaded) return nnReady();
  loaded = true;
  try {
    if (fs.existsSync(WEIGHTS_PATH)) {
      const json = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
      loadNnWeights(json);
      console.log('[nn] 已加载神经网络权重');
    } else {
      console.log('[nn] 未找到 nn-weights.json，困难电脑使用启发式策略');
    }
  } catch (err) {
    console.warn('[nn] 权重加载失败：', err.message);
  }
  return nnReady();
}

/** 意图分类 → 中文短语，用于把网络的"想法"讲给玩家听 */
export const INTENT_TEXT = ['抢分', '补齐宝石', '争取贵族', '补加成', '预订卡位'];

export function nnAvailable() {
  return ensureNnLoaded();
}

/**
 * 用神经网络选一手；失败返回 null（调用方回退启发式）。
 */
/**
 * 让网络"说出"它此刻的打算：返回 { text, value } 或 null。
 * 这是模型表达能力的出口——玩家能在战报里看到 AI 的想法。
 */
export function nnThought(state, playerId) {
  const info = nnInsight(state, playerId);
  if (!info) return null;
  const label = INTENT_TEXT[info.intentBest] || '观察局势';
  const value = info.value;
  return { label, value };
}

export function chooseNnAction(state, playerId, opts = {}) {
  if (!ensureNnLoaded()) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;

  const actions = listAllActions(state, playerId);
  if (!actions.length) return null;

  try {
    const seat = player.seat;
    const { cards, nobles, players, glob } = encodeState(state, seat);
    const { actions: actionVecs, mask } = encodeActions(state, actions, seat);
    const out = nnEvaluate({ cards, nobles, players, glob, actions: actionVecs, mask });

    // 采样 top-k 而不是永远取最大，避免可预测
    const order = [...out.probs.keys()].sort((a, b) => out.probs[b] - out.probs[a]);
    if (opts.stochastic) {
      const top = order.slice(0, 3);
      const total = top.reduce((n, i) => n + out.probs[i], 0);
      let r = Math.random() * total;
      for (const i of top) {
        r -= out.probs[i];
        if (r <= 0) return actions[i];
      }
      return actions[top[0]];
    }

    // 混合决策：网络给出候选与先验，启发式 rollout 负责精确估值。
    // 这样既保留网络的全局感知，又不会因为策略网络的小误差直接走坏棋。
    if (opts.search) {
      const key = (a) => JSON.stringify(a).replace(/"(tier|index)":(\d)/g, '"$1":$2');
      const pool = new Map();
      for (const a of listLegalActions(state, playerId)) pool.set(key(a), a);
      const k = Math.min(8, order.length);
      for (let r = 0; r < k; r += 1) {
        const a = actions[order[r]];
        if (a) pool.set(key(a), a);
      }

      let best = null;
      let bestScore = -Infinity;
      for (const a of pool.values()) {
        try {
          const next = applyAction(state, playerId, a);
          const score = rolloutScore(next, playerId);
          if (score > bestScore) {
            bestScore = score;
            best = a;
          }
        } catch {
          /* 非法则跳过 */
        }
      }
      if (best) return best;
    }

    return actions[out.best];
  } catch (err) {
    console.warn('[nn] 推理失败，回退启发式：', err.message);
    return null;
  }
}

/** 供调试：返回网络对当前局面的评估 */
export function nnInsight(state, playerId) {
  if (!ensureNnLoaded()) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const actions = listAllActions(state, playerId);
  if (!actions.length) return null;
  const { cards, nobles, players, glob } = encodeState(state, player.seat);
  const { actions: actionVecs, mask } = encodeActions(state, actions, player.seat);
  const out = nnEvaluate({ cards, nobles, players, glob, actions: actionVecs, mask });
  return {
    value: out.value,
    intent: [...out.intent],
    intentBest: out.intentBest,
    probs: [...out.probs],
    actions,
  };
}
