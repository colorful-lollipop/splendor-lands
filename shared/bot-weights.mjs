/**
 * 电脑 AI 的启发式权重。
 * 由 `scripts/train.mjs` 通过自对弈进化策略自动调优，可随时重新训练覆盖本文件。
 * 最后训练：2026-11-06T09:06:29.072Z
 */
export const WEIGHTS = {
  pointValue: 18.1249,
  cardCountValue: 1.4151,
  bonusValue: 6.6641,
  nobleValue: 1.5844,
  goldValue: 2.5963,
  tokenPenalty: 1.1,
  opponentWeight: 0.3745,
  cardPoints: 6.5673,
  cardBase: 3.4,
  cardNoble: 0.3449,
  cardWeakColor: 1.1267,
  cardDeficitPenalty: 1.2556,
  cardGoldPenalty: 0.5945,
  cardThreat: 0.9817,
  tier3Bonus: 2.5008,
  tier2Bonus: 0.7635,
  targetWeight: 2.6111,
  secondaryTargetWeight: 0.8879,
  nobleTokenWeight: 0.6441,
  denyWeight: 0.1236,
  doubleTokenBias: 2.8036,
  reserveThreshold: 6.2,
  reservePenalty: 1.8,
};
