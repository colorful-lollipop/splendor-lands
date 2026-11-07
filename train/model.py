"""璀璨宝石的神经网络策略 —— 面向 ONNX 导出的固定形状设计。

设计思路（对应"有感知与表达能力"的要求）：

1. **集合化感知**：牌桌上的 12 张卡、5 位贵族、4 名玩家都被编码成 token，
   统一送进 Transformer。模型不需要知道"第几张卡"，而是通过注意力自己
   发现"这张卡补全了我缺的祖母绿"这类关系。
2. **对手建模**：玩家 token 带 `is_self` 标记，注意力可以跨玩家比较，
   辅助头显式预测"对手下一手会买哪张"，逼迫表征里包含对手意图。
3. **指针式决策**：动作不是固定维度，而是每个合法动作编码成一个向量，
   用状态向量与动作向量的点积打分（pointer network）。
   动作数量随局面变化时天然适配。
4. **意图向量（goal latent）**：一个额外的注意力头专门从牌面里选出
   "我打算买的目标卡"，其输出作为 query 偏置注入策略层 ——
   这就是"目标感"的显式实现。
5. **表达头**：输出一个 8 维"意图语义向量"，训练时对齐到
   「抢分 / 补色 / 冲贵族 / 卡位 / 预订」五类意图，可反解成给玩家看的文字。
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

N_CARD = 12
N_NOBLE = 5
N_PLAYER = 4
MAX_ACTIONS = 96

F_CARD = 16
F_NOBLE = 12
F_PLAYER = 18
F_GLOBAL = 12
F_ACTION = 40

INTENT_DIM = 8
N_INTENT = 5


class SplendorNet(nn.Module):
    def __init__(self, d_model: int = 96, layers: int = 3, heads: int = 4, dropout: float = 0.1):
        super().__init__()
        self.d_model = d_model

        self.card_in = nn.Linear(F_CARD, d_model)
        self.noble_in = nn.Linear(F_NOBLE, d_model)
        self.player_in = nn.Linear(F_PLAYER, d_model)
        self.global_in = nn.Linear(F_GLOBAL, d_model)

        # 类型嵌入：告诉模型这个 token 是卡 / 贵族 / 玩家 / 全局
        self.type_emb = nn.Embedding(4, d_model)
        # 位置嵌入：卡用 (tier, slot) 的组合位置，其余用各自序号
        self.pos_emb = nn.Embedding(N_CARD + N_NOBLE + N_PLAYER + 1, d_model)

        enc = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=heads,
            dim_feedforward=d_model * 4,
            dropout=dropout,
            batch_first=True,
            norm_first=True,
            activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(enc, num_layers=layers, enable_nested_tensor=False)

        # 状态池化：一个可学习的 query 去"提问"整张牌桌
        self.pool_query = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)
        self.pool_attn = nn.MultiheadAttention(d_model, heads, batch_first=True, dropout=dropout)

        # 意图头：专门挑出"目标卡"
        self.goal_query = nn.Parameter(torch.randn(1, 1, d_model) * 0.02)
        self.goal_attn = nn.MultiheadAttention(d_model, heads, batch_first=True, dropout=dropout)
        self.goal_proj = nn.Sequential(nn.Linear(d_model, d_model), nn.GELU(), nn.Linear(d_model, d_model))

        # 动作编码
        self.act_in = nn.Linear(F_ACTION, d_model)
        self.act_mlp = nn.Sequential(
            nn.Linear(d_model, d_model * 2),
            nn.GELU(),
            nn.Linear(d_model * 2, d_model),
        )
        self.act_norm = nn.LayerNorm(d_model)

        # 价值头
        self.value_head = nn.Sequential(
            nn.Linear(d_model * 2, d_model),
            nn.GELU(),
            nn.Linear(d_model, 1),
        )

        # 辅助头：对手下一手买哪张（12 张明牌）、下一位贵族（5 位）、终局分
        self.aux_opp_card = nn.Linear(d_model, N_CARD)
        self.aux_next_noble = nn.Linear(d_model, N_NOBLE)
        self.aux_final_score = nn.Linear(d_model, 1)

        # 意图语义向量 + 五类意图分类
        self.intent_proj = nn.Sequential(nn.Linear(d_model * 2, d_model), nn.GELU(), nn.Linear(d_model, INTENT_DIM))
        self.intent_cls = nn.Linear(INTENT_DIM, N_INTENT)

        self.register_buffer("pos_ids", torch.arange(N_CARD + N_NOBLE + N_PLAYER + 1), persistent=False)

    def encode(self, cards, nobles, players, glob):
        """
        cards:   (B, 12, F_CARD)
        nobles:  (B, 5,  F_NOBLE)
        players: (B, 4,  F_PLAYER)
        glob:    (B, F_GLOBAL)
        """
        b = cards.shape[0]
        x_cards = self.card_in(cards) + self.type_emb.weight[0]
        x_nobles = self.noble_in(nobles) + self.type_emb.weight[1]
        x_players = self.player_in(players) + self.type_emb.weight[2]
        x_glob = self.global_in(glob).unsqueeze(1) + self.type_emb.weight[3]

        x = torch.cat([x_cards, x_nobles, x_players, x_glob], dim=1)
        pos = self.pos_ids[: x.shape[1]]
        x = x + self.pos_emb(pos).unsqueeze(0)
        h = self.encoder(x)

        q = self.pool_query.expand(b, -1, -1)
        pooled, _ = self.pool_attn(q, h, h, need_weights=False)
        state = pooled.squeeze(1)

        goal, goal_w = self.goal_attn(self.goal_query.expand(b, -1, -1), h, h, need_weights=True)
        goal = self.goal_proj(goal.squeeze(1))

        return h, state, goal, goal_w

    def forward(self, cards, nobles, players, glob, actions, action_mask):
        """
        actions:      (B, A, F_ACTION)
        action_mask:  (B, A) 1 = 合法
        返回：logits (B,A)、value (B,)、intent (B,8)、各类辅助输出
        """
        h, state, goal, goal_w = self.encode(cards, nobles, players, glob)

        a = self.act_norm(self.act_mlp(F.gelu(self.act_in(actions))))
        # 目标向量偏置：把"我想买什么"直接注入动作打分
        q = (state + goal) / 2.0
        logits = torch.einsum("bd,bad->ba", q, a) / (self.d_model ** 0.5)
        logits = logits.masked_fill(action_mask <= 0, -1e9)

        feat = torch.cat([state, goal], dim=-1)
        value = self.value_head(feat).squeeze(-1)

        intent = self.intent_proj(feat)
        intent_logits = self.intent_cls(intent)

        return {
            "logits": logits,
            "value": value,
            "intent": intent,
            "intent_logits": intent_logits,
            "aux_opp_card": self.aux_opp_card(state),
            "aux_next_noble": self.aux_next_noble(state),
            "aux_final_score": self.aux_final_score(state).squeeze(-1),
            "goal_weight": goal_w.mean(dim=1),
        }

    def policy_value(self, cards, nobles, players, glob, actions, action_mask):
        """推理用：只要策略与价值。"""
        out = self.forward(cards, nobles, players, glob, actions, action_mask)
        logp = F.log_softmax(out["logits"], dim=-1)
        return logp, out["value"]


class OnnxWrapper(nn.Module):
    """导出用包装：把 dict 输出摊平成 tuple，方便 onnxruntime 读取。"""

    def __init__(self, net: SplendorNet):
        super().__init__()
        self.net = net

    def forward(self, cards, nobles, players, glob, actions, action_mask):
        out = self.net(cards, nobles, players, glob, actions, action_mask)
        return (
            out["logits"],
            out["value"],
            out["intent"],
            out["aux_opp_card"],
            out["aux_next_noble"],
            out["aux_final_score"],
            out["goal_weight"],
        )
