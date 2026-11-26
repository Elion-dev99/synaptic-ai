"""学習済みデータセットの文を分野ごとにまとめ直し、公開中の脳へ分野タグを後付けする。

edges は一切変更しない（タグ付け専用エンドポイントを使う）。
使い方: python3 backfill_fields.py
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from teach_file import field_for  # noqa: E402

BASE = "https://synaptic-ai.elion-dev08.workers.dev"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Content-Type": "application/json"}
HERE = Path(__file__).parent


def post(path, payload):
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def get(path):
    req = urllib.request.Request(BASE + path, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def items_from_dataset(path):
    items, cur = [], None
    for ln in path.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln.startswith("#"):
            cur = field_for(ln) or cur
        elif ln and cur:
            items.append({"text": ln, "field": cur})
    return items


def items_from_teach_py():
    """teach.py の CURRICULUM はコメント行が分野見出し。出現順に拾う。"""
    src = (HERE / "teach.py").read_text(encoding="utf-8")
    items, cur = [], None
    in_curr = False
    for ln in src.splitlines():
        s = ln.strip()
        if s.startswith("CURRICULUM"):
            in_curr = True
            continue
        if in_curr and s.startswith("]"):
            break
        if not in_curr:
            continue
        if s.startswith("#"):
            cur = field_for(s) or cur
            continue
        for m in re.findall(r'"([^"]+)"', ln):
            if cur and len(m) >= 4:
                items.append({"text": m, "field": cur})
    return items


def main():
    items = []
    for name in ["dataset_universal.txt", "dataset_structured.txt",
                 "dataset_universal_en.txt", "dataset_structured_en.txt"]:
        got = items_from_dataset(HERE / name)
        print(name, len(got))
        items.extend(got)
    got = items_from_teach_py()
    print("teach.py curriculum", len(got))
    items.extend(got)
    print("TOTAL items:", len(items))

    total = 0
    for i in range(0, len(items), 100):
        batch = items[i:i + 100]
        res = post("/api/fields/backfill", {"items": batch})
        total += res.get("tagged", 0)
        print(f"batch {i // 100 + 1}: tagged {res.get('tagged')}", flush=True)
        time.sleep(0.3)
    print("TAGGED TOKENS:", total)
    m = get("/api/metrics")
    print("FIELDS:", json.dumps(m.get("fields", {}), ensure_ascii=False))


if __name__ == "__main__":
    main()
