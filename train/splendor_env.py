"""璀璨宝石（Splendor）规则的 Python 实现，用于强化学习训练。

设计目标：
- 与 `shared/rules.mjs` 行为保持一致（由 `parity_test.py` 用 JS 生成的对局做校验）。
- 纯 numpy + 紧凑数组，单步开销低，便于在 GPU 上跑大规模自对弈。
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

COLORS = ["w", "b", "g", "r", "k"]
CI = {c: i for i, c in enumerate(COLORS)}
N_COLOR = 5
GOLD = 5

ROOT = Path(__file__).resolve().parent.parent


def load_cards() -> List[dict]:
    data = json.loads((ROOT / "shared" / "cards.json").read_text(encoding="utf-8"))
    return data


def load_nobles() -> List[dict]:
    return json.loads((ROOT / "shared" / "nobles.json").read_text(encoding="utf-8"))


CARDS = load_cards()
NOBLES = load_nobles()
CARD_INDEX = {c["id"]: i for i, c in enumerate(CARDS)}
NOBLE_INDEX = {n["id"]: i for i, n in enumerate(NOBLES)}

# 每张卡：等级、加成色、声望、成本(5)
CARD_TIER = [c["tier"] for c in CARDS]
CARD_BONUS = [CI[c["bonus"]] for c in CARDS]
CARD_POINTS = [c["points"] for c in CARDS]
CARD_COST = [[c["cost"].get(col, 0) for col in COLORS] for c in CARDS]

NOBLE_COST = [[n["cost"].get(col, 0) for col in COLORS] for n in NOBLES]

TOKENS_BY_PLAYERS = {2: 4, 3: 5, 4: 7}


@dataclass
class Player:
    id: str
    name: str
    seat: int
    tokens: List[int] = field(default_factory=lambda: [0] * 6)  # 5 色 + 黄金
    bonuses: List[int] = field(default_factory=lambda: [0] * 5)
    cards: List[int] = field(default_factory=list)
    reserved: List[int] = field(default_factory=list)
    nobles: List[int] = field(default_factory=list)
    points: int = 0

    @property
    def token_total(self) -> int:
        return sum(self.tokens)


@dataclass
class State:
    players: List[Player]
    board: List[List[Optional[int]]]  # 3 层 × 4
    decks: List[List[int]]  # 3 层，列表末尾为顶部
    nobles: List[int]
    tokens: List[int]
    turn: int = 0
    phase: str = "action"  # action | noble | discard | finished
    pending: Optional[dict] = None
    turn_count: int = 0
    round: int = 1
    end_triggered: bool = False
    finished: bool = False
    winners: List[str] = field(default_factory=list)
    start_player: int = 0

    def clone(self) -> "State":
        return State(
            players=[
                Player(
                    id=p.id,
                    name=p.name,
                    seat=p.seat,
                    tokens=list(p.tokens),
                    bonuses=list(p.bonuses),
                    cards=list(p.cards),
                    reserved=list(p.reserved),
                    nobles=list(p.nobles),
                    points=p.points,
                )
                for p in self.players
            ],
            board=[list(row) for row in self.board],
            decks=[list(d) for d in self.decks],
            nobles=list(self.nobles),
            tokens=list(self.tokens),
            turn=self.turn,
            phase=self.phase,
            pending=dict(self.pending) if self.pending else None,
            turn_count=self.turn_count,
            round=self.round,
            end_triggered=self.end_triggered,
            finished=self.finished,
            winners=list(self.winners),
            start_player=self.start_player,
        )


def new_game(player_names: Sequence[str], seed: Optional[int] = None) -> State:
    rng = random.Random(seed)
    n = len(player_names)
    if n < 2 or n > 4:
        raise ValueError("玩家数量必须是 2 到 4")

    decks: List[List[int]] = [[], [], []]
    by_tier: Dict[int, List[int]] = {1: [], 2: [], 3: []}
    for i, t in enumerate(CARD_TIER):
        by_tier[t].append(i)
    for t in (1, 2, 3):
        rng.shuffle(by_tier[t])
        decks[t - 1] = by_tier[t]

    board: List[List[Optional[int]]] = []
    for t in (1, 2, 3):
        row = []
        for _ in range(4):
            row.append(decks[t - 1].pop() if decks[t - 1] else None)
        board.append(row)

    noble_ids = list(range(len(NOBLES)))
    rng.shuffle(noble_ids)
    nobles = noble_ids[: n + 1]

    per = TOKENS_BY_PLAYERS[n]
    tokens = [per] * 5 + [5]

    players = [Player(id=f"p{i}", name=player_names[i], seat=i) for i in range(n)]
    start = rng.randrange(n)
    return State(
        players=players,
        board=board,
        decks=decks,
        nobles=nobles,
        tokens=tokens,
        turn=start,
        start_player=start,
    )


def cost_of(card_id: int) -> List[int]:
    return CARD_COST[card_id]


def payment_plan(player: Player, card_id: int) -> Tuple[bool, List[int], int]:
    """返回 (是否可买, 每种颜色实际支付, 使用黄金数)"""
    cost = CARD_COST[card_id]
    pay = [0] * 5
    gold = 0
    for i in range(5):
        need = max(0, cost[i] - player.bonuses[i])
        use = min(need, player.tokens[i])
        pay[i] = use
        gold += need - use
    if gold > player.tokens[GOLD]:
        return False, pay, gold
    return True, pay, gold


def legal_actions(state: State) -> List[dict]:
    """枚举当前玩家的所有合法动作（结构同 JS 端的 action 对象）。"""
    if state.finished:
        return []
    if state.phase == "noble":
        return [{"type": "chooseNoble", "nobleId": nid} for nid in state.pending["options"]]
    if state.phase == "discard":
        need = state.pending["mustReturn"]
        player = state.players[state.pending["playerId"] == state.players[0].id and 0 or 0]
        player = next(p for p in state.players if p.id == state.pending["playerId"])
        # 简化：只枚举"优先归还数量最多的颜色"的若干组合，保证数量和为 need
        opts = []
        pool = [i for i in range(6) if player.tokens[i] > 0]
        def rec(idx: int, left: int, cur: List[int]):
            if left == 0:
                opts.append({"type": "returnTokens", "tokens": [list(cur)]})
                return
            if idx >= len(pool):
                return
            c = pool[idx]
            for take in range(min(left, player.tokens[c]), -1, -1):
                cur[c] = take
                rec(idx + 1, left - take, cur)
                cur[c] = 0
        rec(0, need, [0] * 6)
        return opts

    player = state.players[state.turn]
    acts: List[dict] = []

    # 拿宝石：3 种不同色；或 2 枚同色（银行 >= 4）
    avail = [i for i in range(5) if state.tokens[i] > 0]
    want = min(3, len(avail))
    if want >= 1:
        from itertools import combinations

        for combo in combinations(avail, want):
            acts.append({"type": "take", "colors": list(combo)})
        for c in avail:
            if state.tokens[c] >= 4:
                acts.append({"type": "take", "colors": [c, c]})

    # 购买
    for t in range(3):
        for idx, cid in enumerate(state.board[t]):
            if cid is None:
                continue
            ok, _, _ = payment_plan(player, cid)
            if ok:
                acts.append({"type": "buy", "source": {"kind": "board", "tier": t + 1, "index": idx}})
    for cid in player.reserved:
        ok, _, _ = payment_plan(player, cid)
        if ok:
            acts.append({"type": "buy", "source": {"kind": "reserved", "cardId": cid}})

    # 预订
    if len(player.reserved) < 3:
        for t in range(3):
            for idx, cid in enumerate(state.board[t]):
                if cid is None:
                    continue
                acts.append({"type": "reserve", "source": {"kind": "board", "tier": t + 1, "index": idx}})
            if state.decks[t]:
                acts.append({"type": "reserve", "source": {"kind": "deck", "tier": t + 1}})
    return acts


def _refill(state: State, tier_idx: int) -> None:
    row = state.board[tier_idx]
    for i in range(4):
        if row[i] is None and state.decks[tier_idx]:
            row[i] = state.decks[tier_idx].pop()


def _grant_noble(state: State, player: Player, noble_id: int) -> None:
    if noble_id in state.nobles:
        state.nobles.remove(noble_id)
    player.nobles.append(noble_id)
    player.points += 3


def _eligible_nobles(state: State, player: Player) -> List[int]:
    out = []
    for nid in state.nobles:
        cost = NOBLE_COST[nid]
        if all(player.bonuses[i] >= cost[i] for i in range(5)):
            out.append(nid)
    return out


def _next_turn(state: State) -> None:
    n = len(state.players)
    state.turn = (state.turn + 1) % n
    if state.turn == state.start_player:
        state.round += 1
    state.turn_count += 1


def _finish_turn(state: State) -> None:
    player = state.players[state.turn]
    eligible = _eligible_nobles(state, player)
    if len(eligible) == 1:
        _grant_noble(state, player, eligible[0])
    elif len(eligible) > 1:
        state.phase = "noble"
        state.pending = {"playerId": player.id, "options": eligible}
        return

    if not state.end_triggered and player.points >= 15:
        state.end_triggered = True
    if state.end_triggered and state.turn == state.start_player and state.turn_count > 0:
        _finish_game(state)
        return

    _next_turn(state)
    if player.token_total > 10:
        state.phase = "discard"
        state.pending = {"playerId": player.id, "mustReturn": player.token_total - 10}
    else:
        state.phase = "action"


def _finish_game(state: State) -> None:
    state.finished = True
    state.phase = "finished"
    best = max(p.points for p in state.players)
    winners = [p for p in state.players if p.points == best]
    fewest = min(len(p.cards) for p in winners)
    state.winners = [p.id for p in winners if len(p.cards) == fewest]


def apply_action(state: State, action: dict) -> State:
    s = state.clone()
    if s.finished:
        raise ValueError("对局已结束")

    kind = action["type"]

    if kind == "chooseNoble":
        player = next(p for p in s.players if p.id == s.pending["playerId"])
        _grant_noble(s, player, action["nobleId"])
        s.pending = None
        s.phase = "action"
        if not s.end_triggered and player.points >= 15:
            s.end_triggered = True
        if s.end_triggered and s.turn == s.start_player:
            _finish_game(s)
            return s
        _next_turn(s)
        if player.token_total > 10:
            s.phase = "discard"
            s.pending = {"playerId": player.id, "mustReturn": player.token_total - 10}
        return s

    if kind == "returnTokens":
        player = next(p for p in s.players if p.id == s.pending["playerId"])
        toks = action["tokens"]
        if isinstance(toks, list) and toks and isinstance(toks[0], list):
            toks = toks[0]
        for i in range(6):
            player.tokens[i] -= toks[i]
            s.tokens[i] += toks[i]
        s.pending = None
        s.phase = "action"
        return s

    player = s.players[s.turn]

    if kind == "take":
        colors = action["colors"]
        if len(colors) == 2 and colors[0] == colors[1]:
            c = colors[0]
            if s.tokens[c] < 4:
                raise ValueError("该颜色不足 4 枚")
            s.tokens[c] -= 2
            player.tokens[c] += 2
        else:
            for c in colors:
                s.tokens[c] -= 1
                player.tokens[c] += 1
        _finish_turn(s)
        return s

    if kind == "reserve":
        src = action["source"]
        if len(player.reserved) >= 3:
            raise ValueError("保留区已满")
        if src["kind"] == "board":
            t = src["tier"] - 1
            cid = s.board[t][src["index"]]
            if cid is None:
                raise ValueError("该位置没有卡牌")
            s.board[t][src["index"]] = None
            player.reserved.append(cid)
            _refill(s, t)
        else:
            t = src["tier"] - 1
            if not s.decks[t]:
                raise ValueError("该等级牌堆已空")
            player.reserved.append(s.decks[t].pop())
        if s.tokens[GOLD] > 0:
            s.tokens[GOLD] -= 1
            player.tokens[GOLD] += 1
        _finish_turn(s)
        return s

    if kind == "buy":
        src = action["source"]
        if src["kind"] == "board":
            t = src["tier"] - 1
            cid = s.board[t][src["index"]]
            if cid is None:
                raise ValueError("该位置没有卡牌")
            s.board[t][src["index"]] = None
            _refill(s, t)
        else:
            cid = src["cardId"]
            player.reserved.remove(cid)
        ok, pay, gold = payment_plan(player, cid)
        if not ok:
            raise ValueError("宝石不足")
        for i in range(5):
            player.tokens[i] -= pay[i]
            s.tokens[i] += pay[i]
        player.tokens[GOLD] -= gold
        s.tokens[GOLD] += gold
        player.cards.append(cid)
        player.points += CARD_POINTS[cid]
        player.bonuses[CARD_BONUS[cid]] += 1
        _finish_turn(s)
        return s

    raise ValueError(f"未知动作 {kind}")


def current_actor(state: State) -> Optional[Player]:
    if state.finished:
        return None
    if state.phase == "action":
        return state.players[state.turn]
    if state.pending:
        return next((p for p in state.players if p.id == state.pending["playerId"]), None)
    return None
