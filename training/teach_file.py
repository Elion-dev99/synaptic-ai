"""データセットファイル（1行1文）を Synaptic AI（本番）へ流し込む汎用スクリプト。

使い方: python3 teach_file.py <dataset.txt> <snapshot-name>
- 実行前にスナップショットを取り、metrics の before/after を出す
- 「#」行と空行はスキップ
- 最後にプローブで思い出しをテストする
"""
import json
import sys
import time
import urllib.request

BASE = "https://synaptic-ai.elion-dev08.workers.dev"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
PROBES = ["電気", "犬", "お金", "自由", "冬", "先生", "走る", "赤", "夢", "音楽",
          "病気", "飛行機", "愛", "速い", "東京", "笑う", "海", "シナプス", "正義", "月"]


def call(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json", "User-Agent": UA},
        method="POST" if data else "GET",
    )
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def main():
    dataset_path, snap_name = sys.argv[1], sys.argv[2]
    sentences = [ln.strip() for ln in open(dataset_path, encoding="utf-8")
                 if ln.strip() and not ln.startswith("#")]
    print(f"DATASET: {len(sentences)} sentences")

    before = call("/api/metrics")
    print("BEFORE:", json.dumps(before, ensure_ascii=False))
    print("SNAPSHOT:", call("/api/snapshot", {"name": snap_name}))

    for i, text in enumerate(sentences, 1):
        call("/api/chat", {"message": text})
        if i % 50 == 0:
            print(f"  taught {i}/{len(sentences)}", flush=True)
        time.sleep(0.12)
    print(f"TAUGHT: {len(sentences)}")

    after = call("/api/metrics")
    print("AFTER:", json.dumps(after, ensure_ascii=False))
    print("DIFF: nodes", after["nodes"] - before["nodes"],
          "/ edges", after["edges"] - before["edges"],
          "/ exp", after["experience_count"] - before["experience_count"],
          "/ auto_runs", after.get("auto_runs", 0) - before.get("auto_runs", 0))

    for probe in PROBES:
        res = call("/api/chat", {"message": probe})
        print(f"PROBE {probe}: {res['reply']}")


if __name__ == "__main__":
    main()
