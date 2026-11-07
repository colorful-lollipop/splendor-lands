/**
 * 自对弈进化训练：不依赖任何深度学习框架，纯 CPU 的"策略梯度"近似。
 *
 * 思路：
 * 1. 把 AI 的启发式权重视为参数向量（shared/bot-weights.mjs）。
 * 2. 每代随机扰动出 N 个候选参数集（(1+λ) 进化策略）。
 * 3. 让候选 A 与当前最优 B 对弈若干局，记录胜率与分差作为适应度。
 * 4. 保留适应度最高者作为下一代基线，逐步逼近更强的策略。
 *
 * 用法：
 *   node scripts/train.mjs             # 默认 12 代 × 12 候选 × 20 局
 *   node scripts/train.mjs 20 16 30    # 代数 候选数 每候选局数
 *   node scripts/train.mjs --eval      # 只评估当前权重，不训练
 */

import fs from 'node:fs';
import { createGame, applyAction } from '../shared/rules.mjs';
import { WEIGHTS } from '../shared/bot-weights.mjs';

const GEN = Number(process.argv[2]) || 12;
const LAMBDA = Number(process.argv[3]) || 12;
const GAMES = Number(process.argv[4]) || 20;
const EVAL_ONLY = process.argv.includes('--eval');

const KEYS = Object.keys(WEIGHTS);

/** 允许被训练的参数（避免改动结构性的阈值） */
const TUNABLE = KEYS.filter(
  (k) =>
    ![
      'tokenPenalty',
      'reserveThreshold',
      'reservePenalty',
      'cardBase',
    ].includes(k),
);

function cloneWeights(w) {
  return { ...w };
}

function mutate(base, sigma) {
  const w = cloneWeights(base);
  for (const k of TUNABLE) {
    const scale = Math.max(0.35, Math.abs(base[k]) * 0.35);
    w[k] = base[k] + (Math.random() * 2 - 1) * sigma * scale;
    w[k] = Math.max(0.05, w[k]);
  }
  return w;
}

/**
 * 一局对弈：a 用 wa，b 用 wb。
 * 返回 { scoreA, scoreB, winner } —— 分数为本局最终声望。
 */
async function playMatch(wa, wb, seed) {
  const bot = await import('../shared/bot.mjs');
  bot.setWeights(wa);
  const players = [
    { id: 'a', name: 'A', isBot: true, botLevel: 'hard' },
    { id: 'b', name: 'B', isBot: true, botLevel: 'hard' },
  ];
  let state = createGame({ players, seed: `train-${seed}`, startPlayer: seed % 2 });
  // B 的权重通过临时替换实现：对 B 的行动单独调用
  let guard = 0;
  while (!state.finished && guard < 1200) {
    guard += 1;
    const actor = state.phase === 'action' ? state.players[state.turn]?.id : state.pending?.playerId;
    if (!actor) break;
    bot.setWeights(actor === 'a' ? wa : wb);
    const action = bot.chooseBotAction(state, actor, 'hard');
    if (!action) break;
    try {
      state = applyAction(state, actor, action);
    } catch {
      break;
    }
  }
  const pa = state.players.find((p) => p.id === 'a')?.points || 0;
  const pb = state.players.find((p) => p.id === 'b')?.points || 0;
  return { pa, pb, winner: pa > pb ? 'a' : pb > pa ? 'b' : 'draw' };
}

async function fitness(wa, wb, games) {
  let win = 0;
  let diff = 0;
  let draws = 0;
  for (let i = 0; i < games; i += 1) {
    const r = await playMatch(wa, wb, i);
    diff += r.pa - r.pb;
    if (r.winner === 'a') win += 1;
    else if (r.winner === 'draw') draws += 1;
  }
  return { winRate: win / games, avgDiff: diff / games, draws };
}

function writeWeights(w, path = 'shared/bot-weights.mjs') {
  const body = KEYS.map((k) => `  ${k}: ${Number(w[k].toFixed(4))},`).join('\n');
  fs.writeFileSync(
    path,
    `/**
 * 电脑 AI 的启发式权重。
 * 由 \`scripts/train.mjs\` 通过自对弈进化策略自动调优，可随时重新训练覆盖本文件。
 * 最后训练：${new Date().toISOString()}
 */
export const WEIGHTS = {
${body}
};
`,
    'utf8',
  );
}

async function main() {
  const bot = await import('../shared/bot.mjs');
  if (typeof bot.setWeights !== 'function') {
    console.error('bot.mjs 需要导出 setWeights()，请先打补丁。');
    process.exit(1);
  }

  let best = cloneWeights(WEIGHTS);
  bot.setWeights(best);

  // 基线：评估当前权重 vs 自身（随机性带来的基准胜率应约 50%）
  const base = await fitness(best, best, Math.min(20, GAMES));
  console.log(`基线自对弈：胜率 ${(base.winRate * 100).toFixed(1)}%，平均分差 ${base.avgDiff.toFixed(2)}`);
  if (EVAL_ONLY) return;

  for (let g = 1; g <= GEN; g += 1) {
    const sigma = 0.22 * (1 - g / (GEN + 2)) + 0.04; // 逐渐收敛
    const candidates = [];
    for (let i = 0; i < LAMBDA; i += 1) {
      const w = i === 0 ? cloneWeights(best) : mutate(best, sigma);
      candidates.push({ w, f: await fitness(w, best, GAMES) });
    }
    candidates.sort((x, y) => y.f.winRate - x.f.winRate || y.f.avgDiff - x.f.avgDiff);
    const champ = candidates[0];
    // 只有明显更强才替换基线，防止过拟合随机噪声
    if (champ.f.winRate > 0.52 && champ.f.avgDiff > 0.2) {
      best = champ.w;
      bot.setWeights(best);
      writeWeights(best);
      console.log(
        `第 ${g} 代：新基线胜率 ${(champ.f.winRate * 100).toFixed(1)}%，分差 ${champ.f.avgDiff.toFixed(2)}（sigma ${sigma.toFixed(3)}）`,
      );
    } else {
      console.log(`第 ${g} 代：无显著提升（最佳 ${(champ.f.winRate * 100).toFixed(1)}%），保留基线`);
    }
  }

  // 最终验证：新权重 vs 旧权重（用文件中的原始值做对照）
  const { WEIGHTS: original } = await import('../shared/bot-weights.mjs');
  const finalCheck = await fitness(best, original, Math.min(40, GAMES * 2));
  console.log(`最终：新权重 vs 原始权重，胜率 ${(finalCheck.winRate * 100).toFixed(1)}%，分差 ${finalCheck.avgDiff.toFixed(2)}`);
  writeWeights(best);
}

main();
