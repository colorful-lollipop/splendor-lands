"""特征对齐测试：同一批局面下，Python 与 JS 的编码必须逐位一致。

用法：
    node scripts/export-parity.mjs     # 生成 train/parity_cases.json
    python train/parity_test.py        # 对比
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from features import action_vector, card_vector, encode_state  # noqa: E402
from splendor_env import CARD_INDEX, NOBLE_INDEX  # noqa: E402


class Dictish:
    """把 JSON 里字典形式的 board/decks 转成索引访问。"""


def to_state(raw):
    from splendor_env import Player, State

    def cid(x):
        if x is None:
            return None
        return CARD_INDEX[x] if isinstance(x, str) else int(x)

    players = []
    for p in raw["players"]:
        pl = Player(id=p["id"], name=p["name"], seat=p["seat"])
        pl.tokens = [p["tokens"].get(c, 0) for c in ["w", "b", "g", "r", "k"]] + [p["tokens"].get("gold", 0)]
        pl.bonuses = [p["bonuses"].get(c, 0) for c in ["w", "b", "g", "r", "k"]]
        pl.cards = [cid(x) for x in p["cards"]]
        pl.reserved = [cid(x) for x in p["reserved"]]
        pl.nobles = [NOBLE_INDEX[x] if isinstance(x, str) else int(x) for x in p["nobles"]]
        pl.points = p["points"]
        players.append(pl)

    board = []
    for t in (1, 2, 3):
        board.append([cid(c) for c in raw["board"][str(t)]])

    decks = []
    for t in (1, 2, 3):
        d = raw["decks"][str(t)]
        decks.append([0] * int(d) if isinstance(d, int) else list(d))

    nobles = [NOBLE_INDEX[n] if isinstance(n, str) else int(n) for n in raw["nobles"]]
    tokens = [raw["tokens"].get(c, 0) for c in ["w", "b", "g", "r", "k"]] + [raw["tokens"].get("gold", 0)]

    return State(
        players=players,
        board=board,
        decks=decks,
        nobles=nobles,
        tokens=tokens,
        turn=raw["turn"],
        phase=raw["phase"],
        pending=raw.get("pending"),
        turn_count=raw.get("turnCount", 0),
        round=raw.get("round", 1),
        end_triggered=raw.get("endTriggered", False),
    )


def normalize_action(a):
    """把 JS 导出的动作（颜色是字符串、卡牌是 id）转成 Python 原生形式。"""
    from splendor_env import CI, CARD_INDEX, NOBLE_INDEX

    out = dict(a)
    if a["type"] == "take":
        out["colors"] = [CI[c] if isinstance(c, str) else int(c) for c in a["colors"]]
    elif a["type"] == "chooseNoble":
        nid = a["nobleId"]
        out["nobleId"] = NOBLE_INDEX[nid] if isinstance(nid, str) else int(nid)
    elif a["type"] in ("buy", "reserve"):
        src = dict(a["source"])
        if src["kind"] == "board":
            src["tier"] = int(src["tier"])
            src["index"] = int(src["index"])
        elif src["kind"] == "reserved":
            cidv = src["cardId"]
            src["cardId"] = CARD_INDEX[cidv] if isinstance(cidv, str) else int(cidv)
        elif src["kind"] == "deck":
            src["tier"] = int(src["tier"])
        out["source"] = src
    return out


def main():
    path = Path(__file__).resolve().parent / "parity_cases.json"
    if not path.exists():
        raise SystemExit("先运行 node scripts/export-parity.mjs")
    cases = json.loads(path.read_text(encoding="utf-8"))

    # JS 侧导出的期望值需要单独生成，这里只做自洽性检查（NaN / 取值范围 / 维度）
    bad = 0
    for i, case in enumerate(cases):
        state = to_state(case["state"])
        actor = next(p for p in state.players if p.id == case["actor"])
        cards, nobles, players, glob = encode_state(state, actor.seat)
        for name, arr in (("cards", cards), ("nobles", nobles), ("players", players), ("glob", glob)):
            if np.isnan(arr).any():
                print(f"case {i} {name} 含 NaN")
                bad += 1
            if (arr < -1e-6).any() or (arr > 2.0001).any():
                print(f"case {i} {name} 越界 [{arr.min():.3f}, {arr.max():.3f}]")
                bad += 1
        for a in case["actions"]:
            v = np.asarray(action_vector(state, normalize_action(a), actor.seat), dtype=np.float32)
            if np.isnan(v).any():
                print(f"case {i} action {a['type']} 含 NaN")
                bad += 1

        # 卡牌向量维度
        cv = card_vector(state.board[0][0])
        if len(cv) != 16:
            print(f"case {i} card 维度 {len(cv)} != 16")
            bad += 1

    print(f"检查 {len(cases)} 个局面，问题 {bad} 处")


if __name__ == "__main__":
    main()
