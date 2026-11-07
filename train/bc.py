"""行为克隆（BC）预训练：把启发式强 AI 的决策蒸馏进神经网络。

比从零自对弈快得多：几轮就能让网络的走子质量接近启发式，
之后再接 PPO 自对弈继续提升（见 train/train.py）。

用法：
    python train/bc.py --data train/data/imitation.jsonl --epochs 12
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F

sys.path.insert(0, str(Path(__file__).resolve().parent))

from features import encode_actions, encode_state  # noqa: E402
from model import SplendorNet  # noqa: E402
from snapshot import action_key, normalize_action, snapshot_to_state  # noqa: E402
from splendor_env import legal_actions  # noqa: E402

ROOT = Path(__file__).resolve().parent
CKPT = ROOT / "checkpoints"


def build_dataset(path: Path, limit: int = 0) -> List[Tuple]:
    items = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if rec.get("state", {}).get("phase") != "action":
                continue
            state = snapshot_to_state(rec["state"])
            seat = int(rec["seat"])
            acts = legal_actions(state)
            if not acts:
                continue
            target = action_key(rec["action"])
            idx = -1
            for i, a in enumerate(acts):
                if action_key(normalize_action(a) if isinstance(a["type"], str) else a) == target:
                    idx = i
                    break
            if idx < 0:
                continue
            cards, nobles, players, glob = encode_state(state, seat)
            avecs, mask = encode_actions(state, acts, seat)
            items.append(
                (
                    cards,
                    nobles,
                    players,
                    glob,
                    avecs,
                    mask,
                    idx,
                    int(rec.get("intent", 3)),
                    float(rec.get("finalPoints", 0)) / 18.0,
                )
            )
            if limit and len(items) >= limit:
                break
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "data" / "imitation.jsonl"))
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    args = ap.parse_args()

    path = Path(args.data)
    if not path.exists():
        raise SystemExit(f"缺少数据 {path}，先运行 node scripts/gen-imitation.mjs")

    print("读取数据…")
    items = build_dataset(path, args.limit)
    print(f"样本 {len(items)} 条")
    if not items:
        raise SystemExit("没有可用样本")

    device = torch.device(args.device)
    net = SplendorNet().to(device)
    opt = torch.optim.AdamW(net.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
    CKPT.mkdir(parents=True, exist_ok=True)

    n = len(items)
    for ep in range(1, args.epochs + 1):
        perm = np.random.permutation(n)
        tot_loss = 0.0
        tot_acc = 0.0
        steps = 0
        for i in range(0, n, args.batch):
            batch = [items[k] for k in perm[i : i + args.batch]]
            cards = torch.from_numpy(np.stack([b[0] for b in batch])).to(device)
            nobles = torch.from_numpy(np.stack([b[1] for b in batch])).to(device)
            players = torch.from_numpy(np.stack([b[2] for b in batch])).to(device)
            glob = torch.from_numpy(np.stack([b[3] for b in batch])).to(device)
            acts = torch.from_numpy(np.stack([b[4] for b in batch])).to(device)
            mask = torch.from_numpy(np.stack([b[5] for b in batch])).to(device)
            target = torch.tensor([b[6] for b in batch], device=device, dtype=torch.long)
            intent_y = torch.tensor([b[7] for b in batch], device=device, dtype=torch.long)
            final_y = torch.tensor([b[8] for b in batch], device=device, dtype=torch.float32)

            out = net(cards, nobles, players, glob, acts, mask)
            ce = F.cross_entropy(out["logits"], target)
            intent_loss = F.cross_entropy(out["intent_logits"], intent_y)
            value_loss = F.mse_loss(out["aux_final_score"], final_y)
            loss = ce + 0.2 * intent_loss + 0.3 * value_loss

            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0)
            opt.step()

            with torch.no_grad():
                acc = (out["logits"].argmax(dim=-1) == target).float().mean().item()
            tot_loss += float(ce.item())
            tot_acc += acc
            steps += 1

        sched.step()
        print(f"[epoch {ep:02d}] ce={tot_loss / steps:.4f} acc={tot_acc / steps:.3f}")
        torch.save({"model": net.state_dict(), "opt": opt.state_dict(), "iter": ep, "bc": True}, CKPT / "splendor_bc.pt")

    torch.save({"model": net.state_dict(), "opt": opt.state_dict(), "iter": args.epochs, "bc": True}, CKPT / "splendor_best.pt")
    print("已保存 train/checkpoints/splendor_bc.pt 与 splendor_best.pt")


if __name__ == "__main__":
    main()
