/**
 * 纯 JS 的神经网络推理（零依赖）。
 *
 * 与 `train/model.py` 的 `SplendorNet` 逐层对应：
 *   token 嵌入 → 3 层 Pre-LN Transformer → 注意力池化 → 意图注意力 →
 *   动作编码 MLP → 点积打分（pointer policy） → softmax 选动作。
 *
 * 权重来自 `shared/nn-weights.json`（由 `train/export_weights.py` 导出）。
 */

const N_COLOR = 5;

let W = null;
let CFG = { d_model: 96, max_actions: 96 };

/* ---------------- 基础运算 ---------------- */

function matvec(m, v, out = null) {
  const rows = m.length;
  const cols = v.length;
  const res = out || new Float32Array(rows);
  for (let r = 0; r < rows; r += 1) {
    const base = r * cols;
    let sum = 0;
    for (let c = 0; c < cols; c += 1) sum += m[base + c] * v[c];
    res[r] = sum;
  }
  return res;
}

function gemm(n, v) {
  const rows = n.length / v.length;
  const cols = v.length;
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r += 1) {
    const base = r * cols;
    let s = 0;
    for (let c = 0; c < cols; c += 1) s += n[base + c] * v[c];
    out[r] = s;
  }
  return out;
}

function addBias(v, b) {
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i += 1) out[i] = v[i] + (b ? b[i] : 0);
  return out;
}

function layerNorm(x, gamma, beta, eps = 1e-5) {
  const n = x.length;
  let mean = 0;
  for (let i = 0; i < n; i += 1) mean += x[i];
  mean /= n;
  let varSum = 0;
  for (let i = 0; i < n; i += 1) {
    const d = x[i] - mean;
    varSum += d * d;
  }
  const inv = 1 / Math.sqrt(varSum / n + eps);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (x[i] - mean) * inv * gamma[i] + beta[i];
  return out;
}

function gelu(x) {
  // 与 torch 的 exact gelu 一致
  return x.map((v) => 0.5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v * v * v))));
}

function softmax(v) {
  let max = -Infinity;
  for (let i = 0; i < v.length; i += 1) if (v[i] > max) max = v[i];
  const out = new Float32Array(v.length);
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) {
    const e = Math.exp(v[i] - max);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < v.length; i += 1) out[i] /= sum;
  return out;
}

/* ---------------- 权重加载 ---------------- */

function tensor(name) {
  const t = W[name];
  if (!t) throw new Error(`缺少权重 ${name}`);
  return t.data;
}

function shape(name) {
  return W[name].shape;
}

export function loadNnWeights(json) {
  W = json.tensors;
  CFG.d_model = json.config?.d_model || 96;
  CFG.max_actions = json.config?.max_actions || 96;
  return true;
}

export function nnReady() {
  return Boolean(W);
}

/* ---------------- 注意力 ---------------- */

function mha(x, prefix, nHeads) {
  // x: Float32Array[nTokens * d]
  const d = CFG.d_model;
  const nTok = x.length / d;
  const headDim = d / nHeads;
  const inProj = tensor(`${prefix}.in_proj_weight`); // (3d, d)
  const inBias = tensor(`${prefix}.in_proj_bias`);
  const outProj = tensor(`${prefix}.out_proj.weight`);
  const outBias = tensor(`${prefix}.out_proj.bias`);

  const q = new Float32Array(nTok * d);
  const k = new Float32Array(nTok * d);
  const v = new Float32Array(nTok * d);

  for (let t = 0; t < nTok; t += 1) {
    const xt = x.subarray(t * d, t * d + d);
    for (let r = 0; r < d; r += 1) {
      let sq = 0;
      let sk = 0;
      let sv = 0;
      for (let c = 0; c < d; c += 1) {
        const xc = xt[c];
        sq += inProj[r * d + c] * xc;
        sk += inProj[(d + r) * d + c] * xc;
        sv += inProj[(2 * d + r) * d + c] * xc;
      }
      q[t * d + r] = sq + inBias[r];
      k[t * d + r] = sk + inBias[d + r];
      v[t * d + r] = sv + inBias[2 * d + r];
    }
  }

  const out = new Float32Array(nTok * d);
  const scale = 1 / Math.sqrt(headDim);
  for (let h = 0; h < nHeads; h += 1) {
    const off = h * headDim;
    for (let i = 0; i < nTok; i += 1) {
      const scores = new Float32Array(nTok);
      for (let j = 0; j < nTok; j += 1) {
        let s = 0;
        for (let c = 0; c < headDim; c += 1) s += q[i * d + off + c] * k[j * d + off + c];
        scores[j] = s * scale;
      }
      const p = softmax(scores);
      for (let j = 0; j < nTok; j += 1) {
        const wgt = p[j];
        if (wgt === 0) continue;
        for (let c = 0; c < headDim; c += 1) out[i * d + off + c] += wgt * v[j * d + off + c];
      }
    }
  }

  const proj = new Float32Array(nTok * d);
  for (let t = 0; t < nTok; t += 1) {
    const ot = out.subarray(t * d, t * d + d);
    for (let r = 0; r < d; r += 1) {
      let s = 0;
      for (let c = 0; c < d; c += 1) s += outProj[r * d + c] * ot[c];
      proj[t * d + r] = s + outBias[r];
    }
  }
  return proj;
}

function transformerLayer(x, index, nHeads) {
  const d = CFG.d_model;
  const nTok = x.length / d;
  const p = `encoder.layers.${index}`;

  // Pre-LN self-attention
  const normed = new Float32Array(x.length);
  const g1 = tensor(`${p}.norm1.weight`);
  const b1 = tensor(`${p}.norm1.bias`);
  for (let t = 0; t < nTok; t += 1) {
    const ln = layerNorm(x.subarray(t * d, t * d + d), g1, b1);
    normed.set(ln, t * d);
  }
  const attn = mha(normed, `${p}.self_attn`, nHeads);
  const residual1 = new Float32Array(x.length);
  for (let i = 0; i < x.length; i += 1) residual1[i] = x[i] + attn[i];

  // Pre-LN feed forward
  const g2 = tensor(`${p}.norm2.weight`);
  const b2 = tensor(`${p}.norm2.bias`);
  const w1 = tensor(`${p}.linear1.weight`);
  const bf1 = tensor(`${p}.linear1.bias`);
  const w2 = tensor(`${p}.linear2.weight`);
  const bf2 = tensor(`${p}.linear2.bias`);
  const ffDim = shape(`${p}.linear1.weight`)[0];

  const out = new Float32Array(x.length);
  for (let t = 0; t < nTok; t += 1) {
    const ln = layerNorm(residual1.subarray(t * d, t * d + d), g2, b2);
    const h1 = new Float32Array(ffDim);
    for (let r = 0; r < ffDim; r += 1) {
      let s = 0;
      for (let c = 0; c < d; c += 1) s += w1[r * d + c] * ln[c];
      h1[r] = s + bf1[r];
    }
    const act = gelu(h1);
    for (let r = 0; r < d; r += 1) {
      let s = 0;
      for (let c = 0; c < ffDim; c += 1) s += w2[r * ffDim + c] * act[c];
      out[t * d + r] = residual1[t * d + r] + s + bf2[r];
    }
  }
  return out;
}

/* ---------------- 前向 ---------------- */

function embedTokens(cards, nobles, players, glob) {
  const d = CFG.d_model;
  const typeEmb = tensor('type_emb.weight');
  const posEmb = tensor('pos_emb.weight');
  const cardIn = tensor('card_in.weight');
  const cardB = tensor('card_in.bias');
  const nobleIn = tensor('noble_in.weight');
  const nobleB = tensor('noble_in.bias');
  const playerIn = tensor('player_in.weight');
  const playerB = tensor('player_in.bias');
  const globIn = tensor('global_in.weight');
  const globB = tensor('global_in.bias');

  const tokens = [];
  for (let i = 0; i < cards.length; i += 1) {
    const v = gemm(cardIn, cards[i]);
    const t = addBias(v, cardB);
    for (let k = 0; k < d; k += 1) t[k] += typeEmb[k];
    tokens.push(t);
  }
  for (let i = 0; i < nobles.length; i += 1) {
    const v = gemm(nobleIn, nobles[i]);
    const t = addBias(v, nobleB);
    for (let k = 0; k < d; k += 1) t[k] += typeEmb[d + k];
    tokens.push(t);
  }
  for (let i = 0; i < players.length; i += 1) {
    const v = gemm(playerIn, players[i]);
    const t = addBias(v, playerB);
    for (let k = 0; k < d; k += 1) t[k] += typeEmb[2 * d + k];
    tokens.push(t);
  }
  {
    const v = gemm(globIn, glob);
    const t = addBias(v, globB);
    for (let k = 0; k < d; k += 1) t[k] += typeEmb[3 * d + k];
    tokens.push(t);
  }

  const flat = new Float32Array(tokens.length * d);
  tokens.forEach((t, i) => {
    for (let k = 0; k < d; k += 1) flat[i * d + k] = t[k] + posEmb[i * d + k];
  });
  return flat;
}

function attentionPool(x, query, prefix, nHeads) {
  // 单 query 对全序列做一次注意力（等价于 nn.MultiheadAttention 的 batch=1）
  const d = CFG.d_model;
  const nTok = x.length / d;
  const headDim = d / nHeads;
  const inProj = tensor(`${prefix}.in_proj_weight`);
  const inBias = tensor(`${prefix}.in_proj_bias`);
  const outProj = tensor(`${prefix}.out_proj.weight`);
  const outBias = tensor(`${prefix}.out_proj.bias`);

  // query 投影
  const q = new Float32Array(d);
  for (let r = 0; r < d; r += 1) {
    let s = 0;
    for (let c = 0; c < d; c += 1) s += inProj[r * d + c] * query[c];
    q[r] = s + inBias[r];
  }

  const k = new Float32Array(nTok * d);
  const v = new Float32Array(nTok * d);
  for (let t = 0; t < nTok; t += 1) {
    for (let r = 0; r < d; r += 1) {
      let sk = 0;
      let sv = 0;
      for (let c = 0; c < d; c += 1) {
        const xc = x[t * d + c];
        sk += inProj[(d + r) * d + c] * xc;
        sv += inProj[(2 * d + r) * d + c] * xc;
      }
      k[t * d + r] = sk + inBias[d + r];
      v[t * d + r] = sv + inBias[2 * d + r];
    }
  }

  const out = new Float32Array(d);
  const scale = 1 / Math.sqrt(headDim);
  const weights = new Float32Array(nTok);
  for (let h = 0; h < nHeads; h += 1) {
    const off = h * headDim;
    const scores = new Float32Array(nTok);
    for (let j = 0; j < nTok; j += 1) {
      let s = 0;
      for (let c = 0; c < headDim; c += 1) s += q[off + c] * k[j * d + off + c];
      scores[j] = s * scale;
    }
    const p = softmax(scores);
    for (let j = 0; j < nTok; j += 1) weights[j] += p[j] / nHeads;
    for (let j = 0; j < nTok; j += 1) {
      for (let c = 0; c < headDim; c += 1) out[off + c] += p[j] * v[j * d + off + c];
    }
  }

  const proj = new Float32Array(d);
  for (let r = 0; r < d; r += 1) {
    let s = 0;
    for (let c = 0; c < d; c += 1) s += outProj[r * d + c] * out[c];
    proj[r] = s + outBias[r];
  }
  return { vec: proj, weights };
}

function linear(v, prefix) {
  return addBias(gemm(tensor(`${prefix}.weight`), v), tensor(`${prefix}.bias`));
}

/* ---------------- 对外接口 ---------------- */

/**
 * 计算所有候选动作的分数。
 * @param {{cards:number[][], nobles:number[][], players:number[][], glob:number[], actions:number[][], mask:number[]}} input
 * @returns {{logits:Float32Array, probs:Float32Array, value:number, intent:Float32Array, best:number}}
 */
export function nnEvaluate(input) {
  if (!W) throw new Error('神经网络权重未加载');
  const d = CFG.d_model;
  const nHeads = 4;

  let x = embedTokens(input.cards, input.nobles, input.players, input.glob);
  for (let i = 0; i < 3; i += 1) x = transformerLayer(x, i, nHeads);

  const poolQ = tensor('pool_query').slice();
  const stateVec = attentionPool(x, poolQ, 'pool_attn', nHeads).vec;

  const goalQ = tensor('goal_query').slice();
  const goal = attentionPool(x, goalQ, 'goal_attn', nHeads).vec;
  const g1 = gelu(linear(goal, 'goal_proj.0'));
  const goalVec = linear(g1, 'goal_proj.2');

  const q = new Float32Array(d);
  for (let i = 0; i < d; i += 1) q[i] = (stateVec[i] + goalVec[i]) / 2;

  const nAct = input.actions.length;
  const logits = new Float32Array(nAct);
  for (let a = 0; a < nAct; a += 1) {
    const emb = gelu(linear(input.actions[a], 'act_in'));
    const h1 = gelu(linear(emb, 'act_mlp.0'));
    const h2 = linear(h1, 'act_mlp.2');
    const act = layerNorm(h2, tensor('act_norm.weight'), tensor('act_norm.bias'));
    let s = 0;
    for (let i = 0; i < d; i += 1) s += q[i] * act[i];
    logits[a] = s / Math.sqrt(d);
  }
  for (let a = 0; a < nAct; a += 1) if (!input.mask[a]) logits[a] = -1e9;

  const probs = softmax(logits);

  const feat = new Float32Array(d * 2);
  feat.set(stateVec, 0);
  feat.set(goalVec, d);
  const vh1 = gelu(linear(feat, 'value_head.0'));
  const value = linear(vh1, 'value_head.2')[0];

  const ip = gelu(linear(feat, 'intent_proj.0'));
  const intent = linear(ip, 'intent_proj.2');
  const intentLogits = linear(intent, 'intent_cls');

  let best = 0;
  for (let a = 1; a < nAct; a += 1) if (logits[a] > logits[best]) best = a;

  let intentBest = 0;
  for (let i = 1; i < intentLogits.length; i += 1) if (intentLogits[i] > intentLogits[intentBest]) intentBest = i;

  return { logits, probs, value, intent, intentLogits, intentBest, best };
}
