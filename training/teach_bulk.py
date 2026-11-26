"""データセットを /api/teach/bulk で一括学習させる（1文ずつのチャットより桁違いに速い）。

- 見出しコメント（# ）から分野を判定して各文に付ける
- 既存データセット（dataset_*.txt と teach.py）に含まれる文は重複として除く
- 進捗ファイル（<dataset>.progress）に次の開始位置を記録し、途中終了しても再開できる

使い方: python3 teach_bulk.py <dataset> <snapshot名>
"""
import json
import pathlib
import re
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from teach_file import field_for  # noqa: E402

BASE = "https://synaptic-ai.elion-dev08.workers.dev"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Content-Type": "application/json"}
HERE = pathlib.Path(__file__).parent
BATCH = 500


def call(path, payload=None):
    last = None
    for attempt in range(6):
        try:
            data = json.dumps(payload).encode() if payload is not None else None
            req = urllib.request.Request(BASE + path, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(3 * (attempt + 1))
    raise last


def load_items(path):
    items, cur = [], None
    for ln in path.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln.startswith("#"):
            cur = field_for(ln) or cur
        elif ln:
            it = {"message": ln}
            if cur:
                it["field"] = cur
            items.append(it)
    return items


def known_sentences(exclude):
    known = set()
    for f in HERE.glob("dataset_*.txt"):
        if f.name == exclude or f.name.endswith(".failed.txt"):
            continue
        for ln in f.read_text(encoding="utf-8").splitlines():
            ln = ln.strip()
            if ln and not ln.startswith("#"):
                known.add(ln)
    src = (HERE / "teach.py").read_text(encoding="utf-8")
    for m in re.findall(r'"([^"]{4,})"', src):
        known.add(m)
    return known


def main():
    dataset = pathlib.Path(sys.argv[1])
    snap_name = sys.argv[2]
    items = load_items(dataset)
    known = known_sentences(dataset.name)
    seen, uniq = set(), []
    for it in items:
        s = it["message"]
        if s in known or s in seen:
            continue
        seen.add(s)
        uniq.append(it)
    print(f"ITEMS: {len(items)} -> unique new {len(uniq)}", flush=True)

    prog_path = pathlib.Path(str(dataset) + ".progress")
    start = int(prog_path.read_text().strip()) if prog_path.exists() else 0
    if start:
        print(f"RESUME from {start}", flush=True)

    print("BEFORE:", json.dumps(call("/api/metrics"), ensure_ascii=False), flush=True)
    if start == 0:
        print("SNAPSHOT:", call("/api/snapshot", {"name": snap_name}), flush=True)

    total = 0
    for i in range(start, len(uniq), BATCH):
        batch = uniq[i:i + BATCH]
        res = call("/api/teach/bulk", {"items": batch})
        total += res.get("learned", 0)
        prog_path.write_text(str(i + len(batch)))
        print(f"  bulk {i + len(batch)}/{len(uniq)} learned_total={total}", flush=True)
        time.sleep(0.5)
    print("AFTER:", json.dumps(call("/api/metrics"), ensure_ascii=False), flush=True)
    print(f"DONE learned={total}")
    prog_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
