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

# 見出しコメント → 分野キー（部分一致、上のもの優先）
CATEGORY_FIELDS = [
    ("科学", "science"), ("Science", "science"), ("元素", "science"), ("天体", "science"), ("単位", "science"),
    ("動物", "animals"), ("Animals", "animals"),
    ("食べ物", "food"), ("Food", "food"),
    ("身体", "body"), ("Body", "body"),
    ("感情", "emotion"), ("Emotions", "emotion"),
    ("社会", "society"), ("Society", "society"),
    ("テクノロジー", "tech"), ("Technology", "tech"),
    ("乗り物", "transport"), ("Transport", "transport"),
    ("地理", "geography"), ("Geography", "geography"), ("首都", "geography"), ("都道府県", "geography"), ("Capitals", "geography"), ("prefectures", "geography"),
    ("時間", "time"), ("Time", "time"),
    ("生活", "life"), ("Daily life", "life"), ("場所", "life"),
    ("スポーツ", "culture"), ("文化", "culture"), ("Sports", "culture"), ("人物", "culture"), ("figures", "culture"),
    ("抽象", "abstract"), ("Abstract", "abstract"), ("熟語", "abstract"),
    ("学習", "self"),
    ("基礎", "general"),
]


def field_for(header):
    for key, field in CATEGORY_FIELDS:
        if key in header:
            return field
    return None

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
    sentences = []
    cur_field = None
    for ln in open(dataset_path, encoding="utf-8"):
        ln = ln.strip()
        if ln.startswith("#"):
            cur_field = field_for(ln) or cur_field
        elif ln:
            sentences.append((ln, cur_field))
    print(f"DATASET: {len(sentences)} sentences")

    before = call("/api/metrics")
    print("BEFORE:", json.dumps(before, ensure_ascii=False))
    print("SNAPSHOT:", call("/api/snapshot", {"name": snap_name}))

    for i, (text, fld) in enumerate(sentences, 1):
        payload = {"message": text}
        if fld:
            payload["field"] = fld
        call("/api/chat", payload)
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
