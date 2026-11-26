"""Wikipedia（日本語版）の閲覧数上位記事から導入文を取得し、学習用データセットを作る。

方式: Wikimedia Pageviews API で月間トップ記事を取得 → MediaWiki API で導入部（extract）を取得
→ タイトルを含む短文だけを抽出する。重要記事リストのページ名当てに依存しない。

使い方: python3 fetch_wiki2.py <出力ファイル> <月数> <1か月あたりの取得件数>
  例: python3 fetch_wiki2.py dataset_wiki1.txt 3 1000
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "SynapticAITraining/1.0 (personal research; contact: local)"}
MONTHS = ["2026/08", "2026/09", "2026/10", "2026/07", "2026/06", "2026/05"]
SKIP_TITLE = re.compile(r"^(特別:|Wikipedia:|Category:|Template:|ファイル:|メインページ|Help:|Portal:|プロジェクト:)")
SKIP_WORDS = ["一覧", "曖昧さ回避", "訃報", "年表"]


def get_json(url):
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def top_titles(month, limit):
    url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/ja.wikipedia/all-access/{month}/all-days"
    data = get_json(url)
    items = data["items"][0]["articles"]
    titles = []
    for it in items:
        t = it["article"]
        if SKIP_TITLE.search(t) or any(w in t for w in SKIP_WORDS):
            continue
        titles.append(t.replace("_", " "))
        if len(titles) >= limit:
            break
    return titles


def fetch_extracts(titles):
    """MediaWiki API で導入部を取得（20件ずつ）。{title: extract}"""
    out = {}
    for i in range(0, len(titles), 20):
        batch = titles[i:i + 20]
        q = urllib.parse.urlencode({
            "action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
            "format": "json", "titles": "|".join(batch), "redirects": 1,
        })
        data = get_json("https://ja.wikipedia.org/w/api.php?" + q)
        pages = data.get("query", {}).get("pages", {})
        norm = {n["from"]: n["to"] for n in data.get("query", {}).get("normalized", [])}
        redir = {r["from"]: r["to"] for r in data.get("query", {}).get("redirects", [])}
        for page in pages.values():
            if page.get("extract"):
                out[page["title"]] = page["extract"]
        # 正規化・リダイレクトされたタイトルでも引けるよう別名も登録
        for orig in batch:
            t = norm.get(orig, orig)
            t = redir.get(t, t)
            if t in out:
                out[orig] = out[t]
        time.sleep(0.2)
    return out


def clean(text):
    text = re.sub(r"（[^）]*）", "", text)   # 読み仮名などの括弧を除去
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"\s+", "", text)
    return text


def sentences_for(title, extract):
    core = re.sub(r"（[^）]*）$", "", title).strip()
    core = core.split("・")[0].split(" ")[0]
    if len(core) < 2:
        return []
    body = clean(extract)
    got = []
    for s in body.split("。"):
        s = s.strip()
        if core in s and 8 <= len(s) <= 60 and "年" not in s[:3]:
            got.append(s)
        if len(got) >= 2:
            break
    return got


def main():
    out_path = sys.argv[1]
    n_months = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    per_month = int(sys.argv[3]) if len(sys.argv) > 3 else 1000

    titles, seen = [], set()
    for m in MONTHS[:n_months]:
        for t in top_titles(m, per_month):
            if t not in seen:
                seen.add(t)
                titles.append(t)
        print(f"month {m}: cumulative titles {len(titles)}", flush=True)

    extracts = fetch_extracts(titles)
    print("extracts:", len(extracts), "/", len(titles))

    lines, used = [], 0
    for t in titles:
        ex = extracts.get(t)
        if not ex:
            continue
        ss = sentences_for(t, ex)
        if ss:
            used += 1
            lines.extend(ss)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# Wikipedia waves (pageviews top, ja)\n")
        f.write("\n".join(lines) + "\n")
    print(f"WROTE {out_path}: {len(lines)} sentences from {used} articles")


if __name__ == "__main__":
    main()
