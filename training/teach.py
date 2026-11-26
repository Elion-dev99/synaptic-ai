"""Muse が生成した基礎連想カリキュラムを Synaptic AI（本番）へ流し込むスクリプト。

- 実行前にスナップショットを取り、metrics の before/after を出す
- 文章はクラスタ単位（天気・時間・感情・身体・食べ物・生活・自己）で構成
- 中核の文章には +1 フィードバックを付けて報酬を強める
- 最後にプローブ（単語1つ）で思い出しをテストする
"""
import json
import time
import urllib.request

BASE = "https://synaptic-ai.elion-dev08.workers.dev"

CURRICULUM = [
    # 天気・自然
    "雨の日は傘を持つ", "雨が降ると地面が濡れる", "雷は雨と一緒に来る",
    "雪は冬に降る", "雪は白くて冷たい", "太陽は昼に輝く",
    "月は夜に光る", "星は夜空に瞬く", "海は青くて広い",
    "山は高くて緑", "川は山から海へ流れる", "風は雲を運ぶ",
    "雲は雨を降らせる", "虹は雨上がりに出る", "春は桜が咲く",
    "夏は暑くて海が人気", "秋は紅葉が美しい", "冬は寒くて雪が降る",
    # 時間
    "朝は太陽が昇る", "朝ごはんは一日の始まり", "昼は明るくて活動的",
    "夜は静かで眠い", "夜は月と星が見える", "昨日は過去で明日は未来",
    "今日を大切に生きる", "時間は止まらない",
    # 感情
    "嬉しいと笑顔になる", "悲しいと涙が出る", "怒りは心を熱くする",
    "楽しい時間は早く過ぎる", "不安な夜は眠れない", "安心すると心が落ち着く",
    "好きな人と会うと嬉しい", "寂しいと誰かに会いたい", "疲れると休みたくなる",
    "驚くと心臓が跳ねる",
    # 身体・脳
    "目は見るための器官", "耳は音を聞く", "手は物を掴む",
    "足は歩くためにある", "心臓は血液を送る", "脳は考える場所",
    "脳にはシナプスがある", "シナプスは記憶を結ぶ", "眠ると脳は記憶を整理する",
    "夢は眠っている時に見る",
    # 食べ物
    "ご飯は日本の主食", "パンは小麦で作る", "りんごは赤くて甘い",
    "コーヒーは苦くて香りが良い", "お茶は心を落ち着ける", "甘いケーキは幸せな味",
    "辛い料理は汗が出る", "朝食はパンとコーヒー", "味噌汁は温かくて優しい",
    # 生活・場所
    "家は帰る場所", "学校は学ぶ場所", "会社は働く場所",
    "電車は街を走る", "本は知識の宝庫", "音楽は心を豊かにする",
    "映画は物語を映す", "友達は大切な存在", "家族は支え合う",
    "電話は声を届ける",
    # 学習・自己
    "学習は記憶を強くする", "繰り返すと記憶は定着する", "忘れることも学習の一部",
    "経験は人を成長させる", "質問は理解の始まり", "私はシナプスの集まり",
    "私は会話から学習する", "私の名前はSynaptic AI", "記憶は結びつきでできている",
    "学ぶことは変わること",
    # 繰り返し（言い方を変えた中核の再提示）
    "雨には傘が必需品", "夜空には星と月", "嬉しい時は笑う",
    "シナプスが結ぶのは記憶と記憶", "眠ると記憶は整理される",
]

# +1 フィードバックを付ける中核（自己・学習クラスタ＋代表）
CORE = {
    "脳にはシナプスがある", "シナプスは記憶を結ぶ", "眠ると脳は記憶を整理する",
    "学習は記憶を強くする", "繰り返すと記憶は定着する", "私はシナプスの集まり",
    "私は会話から学習する", "私の名前はSynaptic AI", "記憶は結びつきでできている",
    "雨の日は傘を持つ", "月は夜に光る", "嬉しいと笑顔になる",
}

PROBES = ["雨", "夜", "悲しい", "シナプス", "朝", "海"]


def call(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"},
        method=method or ("POST" if data else "GET"),
    )
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # プロキシの一時切断などはリトライ
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def main():
    before = call("/api/metrics")
    print("BEFORE:", json.dumps(before, ensure_ascii=False))
    snap = call("/api/snapshot", {"name": "before-muse-training-20261126"})
    print("SNAPSHOT:", snap)

    taught, fed = 0, 0
    for text in CURRICULUM:
        res = call("/api/chat", {"message": text})
        taught += 1
        if text in CORE and res.get("experience_id"):
            call("/api/feedback", {"experience_id": res["experience_id"], "value": 1.0})
            fed += 1
        time.sleep(0.15)
    print(f"TAUGHT: {taught} sentences, feedback +1: {fed}")

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
