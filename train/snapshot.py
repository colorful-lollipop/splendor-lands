"""把 JS 侧导出的 JSON 快照转换成 Python 的 State 对象。"""

from __future__ import annotations

from typing import Any, Dict

from splendor_env import CARD_INDEX, CI, NOBLE_INDEX, Player, State


def card_id(x):
    if x is None:
        return None
    return CARD_INDEX[x] if isinstance(x, str) else int(x)


def snapshot_to_state(raw: Dict[str, Any]) -> State:
    players = []
    for p in raw["players"]:
        pl = Player(id=p["id"], name=p.get("name", p["id"]), seat=int(p["seat"]))
        pl.tokens = [int(p["tokens"].get(c, 0)) for c in ["w", "b", "g", "r", "k"]] + [int(p["tokens"].get("gold", 0))]
        pl.bonuses = [int(p["bonuses"].get(c, 0)) for c in ["w", "b", "g", "r", "k"]]
        pl.cards = [card_id(x) for x in p.get("cards", [])]
        pl.reserved = [card_id(x) for x in p.get("reserved", [])]
        pl.nobles = [NOBLE_INDEX[x] if isinstance(x, str) else int(x) for x in p.get("nobles", [])]
        pl.points = int(p.get("points", 0))
        players.append(pl)

    board = []
    for t in (1, 2, 3):
        board.append([card_id(c) for c in raw["board"][str(t)]])

    decks = []
    for t in (1, 2, 3):
        d = raw["decks"][str(t)]
        decks.append([0] * int(d) if isinstance(d, int) else [card_id(c) for c in d])

    nobles = []
    for n in raw["nobles"]:
        if isinstance(n, int):
            nobles.append(n)
        elif isinstance(n, str) and n in NOBLE_INDEX:
            nobles.append(NOBLE_INDEX[n])
        else:
            nobles.append(0)

    tokens = [int(raw["tokens"].get(c, 0)) for c in ["w", "b", "g", "r", "k"]] + [int(raw["tokens"].get("gold", 0))]

    return State(
        players=players,
        board=board,
        decks=decks,
        nobles=nobles,
        tokens=tokens,
        turn=int(raw["turn"]),
        phase=raw.get("phase", "action"),
        pending=raw.get("pending"),
        turn_count=int(raw.get("turnCount", 0)),
        round=int(raw.get("round", 1)),
        end_triggered=bool(raw.get("endTriggered", False)),
    )


def action_key(a: Dict[str, Any]) -> tuple:
    """把动作归一化成可比较的键（JS 的 id 与 Python 的整数索引都能处理）。"""
    kind = a["type"]
    if kind == "take":
        colors = tuple(sorted(CI[c] if isinstance(c, str) else int(c) for c in a["colors"]))
        return (kind, colors)
    if kind == "chooseNoble":
        nid = a["nobleId"]
        return (kind, NOBLE_INDEX[nid] if isinstance(nid, str) else int(nid))
    if kind == "returnTokens":
        toks = a["tokens"]
        if isinstance(toks, list):
            return (kind, tuple(toks))
        return (kind, tuple(int(toks.get(c, 0)) for c in ["w", "b", "g", "r", "k", "gold"]))
    src = a["source"]
    if src["kind"] == "board":
        return (kind, "board", int(src["tier"]), int(src["index"]))
    if src["kind"] == "deck":
        return (kind, "deck", int(src["tier"]))
    return (kind, "reserved", card_id(src.get("cardId")))


def normalize_action(a: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(a)
    kind = a["type"]
    if kind == "take":
        out["colors"] = [CI[c] if isinstance(c, str) else int(c) for c in a["colors"]]
    elif kind == "chooseNoble":
        nid = a["nobleId"]
        out["nobleId"] = NOBLE_INDEX[nid] if isinstance(nid, str) else int(nid)
    elif kind in ("buy", "reserve"):
        src = dict(a["source"])
        if src["kind"] == "board":
            src["tier"] = int(src["tier"])
            src["index"] = int(src["index"])
        elif src["kind"] == "deck":
            src["tier"] = int(src["tier"])
        else:
            src["cardId"] = card_id(src.get("cardId"))
        out["source"] = src
    return out
