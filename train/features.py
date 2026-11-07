"""把游戏状态与动作编码成固定形状的张量特征。

特征布局与 `shared/nn-features.mjs` 严格一一对应（同序、同归一化），
否则 JS 端推理会和训练分布不一致。

卡牌特征（16 维）
  0..2   tier one-hot
  3..7   bonus 色 one-hot
  8      points / 5
  9..13  cost / 4
  14     points / 3
  15     空位标记 / cost 总和（二者互斥）

动作特征（40 维）
  0..15  卡牌特征（take 时表示颜色 one-hot；returnTokens 时为零）
  16     take
  17     buy
  18     reserve
  19     chooseNoble
  20     returnTokens
  21     来源为牌堆
  22     来源为保留区
  23     tier / 3
  24     拿取颜色数 / 3
  25     双倍同色标记
  26     现在买得起
  27     使用黄金数 / 3
  28     支付宝石总数 / 10
  29     我方宝石总数 / 10
  30     我方黄金 / 3
  31     我方声望 / 18
  32     我方卡数 / 12
  33     保留卡数 / 3
  34..39 归还的各色数量 / 3
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np

from model import F_ACTION, F_CARD, F_GLOBAL, F_NOBLE, F_PLAYER, MAX_ACTIONS, N_NOBLE, N_PLAYER

from splendor_env import CARD_BONUS, CARD_COST, CARD_POINTS, CARD_TIER, GOLD, NOBLE_COST, State, payment_plan


def _onehot(i: int, n: int) -> List[float]:
    v = [0.0] * n
    if 0 <= i < n:
        v[i] = 1.0
    return v


EMPTY = [0.0] * F_CARD
EMPTY[15] = 1.0


def card_vector(cid) -> List[float]:
    if cid is None:
        return list(EMPTY)
    t = CARD_TIER[cid]
    b = CARD_BONUS[cid]
    pts = CARD_POINTS[cid]
    cost = CARD_COST[cid]
    return (
        _onehot(t - 1, 3)
        + _onehot(b, 5)
        + [pts / 5.0]
        + [c / 4.0 for c in cost]
        + [pts / 3.0, sum(cost) / 14.0]
    )


def encode_state(state: State, seat: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    me = state.players[seat]

    cards = []
    for t in range(3):
        for i in range(4):
            cards.append(card_vector(state.board[t][i]))
    cards = np.asarray(cards, dtype=np.float32)

    nobles = []
    for k in range(N_NOBLE):
        if k >= len(state.nobles):
            nobles.append([0.0] * F_NOBLE)
            continue
        cost = NOBLE_COST[state.nobles[k]]
        missing = [max(0, cost[i] - me.bonuses[i]) for i in range(5)]
        total_missing = sum(missing)
        nobles.append(
            [c / 4.0 for c in cost]
            + [m / 4.0 for m in missing]
            + [1.0 if total_missing == 0 else 0.0, total_missing / 12.0]
        )
    nobles = np.asarray(nobles, dtype=np.float32)

    players = []
    for k in range(N_PLAYER):
        if k >= len(state.players):
            players.append([0.0] * F_PLAYER)
            continue
        p = state.players[k]
        is_self = 1.0 if p.seat == seat else 0.0
        players.append(
            [is_self, 1.0 - is_self]
            + [p.tokens[i] / 7.0 for i in range(6)]
            + [p.bonuses[i] / 6.0 for i in range(5)]
            + [
                p.points / 18.0,
                len(p.cards) / 12.0,
                len(p.nobles) / 3.0,
                len(p.reserved) / 3.0,
                (4 - k) / 4.0,
            ]
        )
    players = np.asarray(players, dtype=np.float32)

    glob = (
        [state.tokens[i] / 7.0 for i in range(6)]
        + [len(state.decks[0]) / 36.0, len(state.decks[1]) / 26.0, len(state.decks[2]) / 16.0]
        + [min(1.0, state.round / 20.0), 1.0 if state.end_triggered else 0.0, sum(me.tokens) / 10.0]
    )
    return cards, nobles, players, np.asarray(glob, dtype=np.float32)


def action_vector(state: State, action: dict, seat: int) -> List[float]:
    me = state.players[seat]
    vec = [0.0] * F_ACTION
    kind = action["type"]

    if kind == "take":
        for c in action["colors"]:
            vec[c] = 1.0
        vec[16] = 1.0
        vec[24] = len(action["colors"]) / 3.0
        vec[25] = 1.0 if len(action["colors"]) == 2 and action["colors"][0] == action["colors"][1] else 0.0
    elif kind == "chooseNoble":
        vec[19] = 1.0
        nid = action["nobleId"]
        idx = state.nobles.index(nid) if nid in state.nobles else 0
        vec[23] = idx / max(1, N_NOBLE - 1)
    elif kind == "returnTokens":
        vec[20] = 1.0
        toks = action["tokens"]
        if isinstance(toks, list) and toks and isinstance(toks[0], list):
            toks = toks[0]
        for i in range(6):
            vec[34 + i] = toks[i] / 3.0
    else:
        src = action["source"]
        vec[17 if kind == "buy" else 18] = 1.0
        if src["kind"] == "board":
            t = src["tier"] - 1
            cid = state.board[t][src["index"]]
            vec[:F_CARD] = card_vector(cid)
            vec[23] = (t + 1) / 3.0
            if cid is not None and kind == "buy":
                ok, pay, gold = payment_plan(me, cid)
                vec[26] = 1.0 if ok else 0.0
                vec[27] = gold / 3.0
                vec[28] = sum(pay) / 10.0
        elif src["kind"] == "deck":
            vec[21] = 1.0
            vec[23] = src["tier"] / 3.0
        else:
            vec[22] = 1.0
            cid = src.get("cardId")
            if cid is not None:
                vec[:F_CARD] = card_vector(cid)

    vec[29] = sum(me.tokens) / 10.0
    vec[30] = me.tokens[GOLD] / 3.0
    vec[31] = me.points / 18.0
    vec[32] = len(me.cards) / 12.0
    vec[33] = len(me.reserved) / 3.0
    return vec


def encode_actions(state: State, actions: List[dict], seat: int) -> Tuple[np.ndarray, np.ndarray]:
    out = np.zeros((MAX_ACTIONS, F_ACTION), dtype=np.float32)
    mask = np.zeros((MAX_ACTIONS,), dtype=np.float32)
    for i, a in enumerate(actions[:MAX_ACTIONS]):
        out[i] = action_vector(state, a, seat)
        mask[i] = 1.0
    return out, mask
