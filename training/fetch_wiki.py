"""日本語版Wikipediaの「全ての言語版にあるべき記事」（重要記事）一覧から
要約の冒頭文を取り出し、学習用データセットを作る。

使い方: python3 fetch_wiki.py <max_titles> <out_file>
- 冒頭文から読み仮名・日付の括弧書きを除去
- 記事タイトルを含む文だけを残す（連想のアンカーにする）
- 1記事あたり最大2文、8〜60文字の文のみ
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

API = "https://ja.wikipedia.org/w/api.php"
UA = {"User-Agent": "SynapticAI-Training/1.0 (educational project)"}
LIST_PAGES = [
    "Wikipedia:全ての言語版にあるべき記事の一覧",
    "Wikipedia:全ての言語版にあるべき記事の一覧/人物",
    "Wikipedia:全ての言語版にあるべき記事の一覧/歴史",
    "Wikipedia:全ての言語版にあるべき記事の一覧/地理",
    "Wikipedia:全ての言語版にあるべき記事の一覧/社会",
    "Wikipedia:全ての言語版にあるべき記事の一覧/科学",
    "Wikipedia:全ての言語版にあるべき記事の一覧/技術",
    "Wikipedia:全ての言語版にあるべき記事の一覧/芸術",
    "Wikipedia:全ての言語版にあるべき記事の一覧/宗教・哲学",
    "Wikipedia:全ての言語版にあるべき記事の一覧/日常生活",
]


def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def collect_titles():
    titles = []
    for page in LIST_PAGES:
        try:
            res = api({"action": "parse", "page": page, "prop": "links",
                       "format": "json", "pllimit": "max"})
        except Exception:
            continue
        for lnk in res.get("parse", {}).get("links", []):
            if lnk.get("ns") == 0 and "*" in lnk:
                t = lnk["*"]
                if not any(s in t for s in ("/", "一覧", "年表")):
                    titles.append(t)
        time.sleep(0.3)
    seen, out = set(), []
    for t in titles:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


PAREN = re.compile(r"（[^）]{0,60}）|\([^)]{0,60}\)")
DATE = re.compile(r"\d{3,4}年\d{0,2}月?\d{0,2}日?")


def clean_sentences(title, extract):
    text = PAREN.sub("", extract)
    text = DATE.sub("", text)
    text = re.sub(r"\s+", "", text)
    sents = [s + "。" for s in text.split("。") if s]
    out = []
    for s in sents:
        s = s.strip("、。 ")
        if not s:
            continue
        sent = s + ""
        if title in sent and 8 <= len(sent) <= 60 and "曖昧さ回避" not in sent:
            out.append(sent)
        if len(out) >= 2:
            break
    return out


def main():
    max_titles = int(sys.argv[1])
    out_file = sys.argv[2]
    titles = collect_titles()
    print(f"TITLES: {len(titles)} (cap {max_titles})")
    titles = titles[:max_titles]

    results = []
    for i in range(0, len(titles), 40):
        batch = titles[i:i + 40]
        res = api({"action": "query", "titles": "|".join(batch),
                   "prop": "extracts", "explaintext": 1, "exintro": 1,
                   "format": "json", "exlimit": "max"})
        pages = res.get("query", {}).get("pages", {})
        by_title = {p.get("title"): p.get("extract", "") for p in pages.values()}
        for t in batch:
            ext = by_title.get(t, "")
            if ext:
                results.extend(clean_sentences(t, ext))
        print(f"  fetched {min(i + 40, len(titles))}/{len(titles)} -> {len(results)} sentences", flush=True)
        time.sleep(0.3)

    dedup = list(dict.fromkeys(results))
    with open(out_file, "w", encoding="utf-8") as f:
        f.write("# Wikipedia重要記事データセット（自動生成）\n")
        f.write("\n".join(dedup) + "\n")
    print(f"WROTE: {len(dedup)} sentences -> {out_file}")


if __name__ == "__main__":
    main()
