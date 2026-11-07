"""导出最新 checkpoint 为 JS 可读的 JSON 权重，并做一次自检。"""
import json
import sys
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model import SplendorNet  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shared" / "nn-weights.json"


def main():
    ckpt_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "train" / "checkpoints" / "splendor.pt"
    if not ckpt_path.exists():
        raise SystemExit(f"找不到 {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location="cpu")
    net = SplendorNet()
    net.load_state_dict(ckpt["model"])
    net.eval()

    tensors = {}
    for name, param in net.state_dict().items():
        if name == "pos_ids":
            continue
        tensors[name] = {
            "shape": list(param.shape),
            "data": [round(float(x), 6) for x in param.flatten().tolist()],
        }

    OUT.write_text(
        json.dumps(
            {
                "config": {"d_model": net.d_model, "max_actions": 96, "iter": ckpt.get("iter", 0)},
                "tensors": tensors,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    mb = OUT.stat().st_size / 1024 / 1024
    print(f"导出 {OUT} ({mb:.2f} MB, {len(tensors)} 张量, iter={ckpt.get('iter')})")


if __name__ == "__main__":
    main()
