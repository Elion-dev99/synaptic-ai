"""Wikipedia Vital Articles Level 4（約1万記事）から日本語版の導入文を取得し、
分野別セクション付きの学習データセットを作る。

流れ: en.wikipedia の Level/4 サブページ群 → 記事リンク収集 → langlinks で日本語タイトル化
→ ja.wikipedia の導入部 → タイトルを含む短文を抽出。

使い方: python3 fetch_wiki3.py <出力ファイル>
"""
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

UA = {"User-Agent": "SynapticAITraining/1.0 (personal research)"}

# サブページ名のキーワード → セクション見出し（teach_file.py の分野マップに合わせる）
TOPIC_HEADERS = [
    ("Animals", "# 動物・生き物"),
    ("Plants", "# 科学・植物と自然"),
    ("Health", "# 身体・健康"),
    ("Biological", "# 科学・生物と宇宙"),
    ("Biology", "# 科学・生物と宇宙"),
    ("Physical sciences", "# 科学・物理と化学"),
    ("Mathematics", "# 単位・数・科学の基礎"),
    ("Measurement", "# 単位・数・科学の基礎"),
    ("Technology", "# テクノロジー・コンピュータ"),
    ("History", "# 歴史・世界の出来事"),
    ("Geography", "# 地理・世界の都市"),
    ("Philosophy", "# 哲学・思想"),
    ("Religion", "# 宗教・世界の宗教"),
    ("Language", "# 文化・文学と音楽"),
    ("Literature", "# 文化・文学と音楽"),
    ("Arts", "# 文化・美術と映画"),
    ("Sports", "# 文化・スポーツ"),
    ("Everyday life", "# 生活・日常"),
    ("Anthropology", "# 生活・日常"),
    ("Society", "# 社会・経済と政治"),
    ("Social sciences", "# 社会・経済と政治"),
    ("People", "# 人物・歴史上の人々"),
    ("Biographies", "# 人物・歴史上の人々"),
]
SKIP_PAGE = ("Article alerts", "Draft", "Candidates", "Archive")


def get_json(base, params):
    last = None
    for attempt in range(7):
        try:
            url = base + "?" + urllib.parse.urlencode(params)
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(30 if '429' in str(last) else 2.0 * (attempt + 1))
    raise last


def header_for(page_title):
    for key, header in TOPIC_HEADERS:
        if key.lower() in page_title.lower():
            return header
    return "# 科学・一般"


def level4_pages():
    pages, cont = [], {}
    while True:
        d = get_json("https://en.wikipedia.org/w/api.php", {
            "action": "query", "maxlag": 5, "list": "allpages", "apprefix": "Vital articles/Level/4",
            "apnamespace": 4, "format": "json", "aplimit": 500, **cont})
        pages += [p["title"] for p in d["query"]["allpages"]]
        if "continue" not in d:
            break
        cont = d["continue"]
    return [p for p in pages if not any(s in p for s in SKIP_PAGE)]


def page_links(page_title):
    titles, cont = [], {}
    while True:
        d = get_json("https://en.wikipedia.org/w/api.php", {
            "action": "query", "maxlag": 5, "prop": "links", "titles": page_title,
            "plnamespace": 0, "format": "json", "pllimit": 500, "redirects": 1, **cont})
        for page in d["query"]["pages"].values():
            titles += [l["title"] for l in page.get("links", [])]
        if "continue" not in d:
            break
        cont = d["continue"]
    return titles


def langlinks_ja(en_titles):
    out = {}
    for i in range(0, len(en_titles), 50):
        batch = en_titles[i:i + 50]
        d = get_json("https://en.wikipedia.org/w/api.php", {
            "action": "query", "maxlag": 5, "prop": "langlinks", "titles": "|".join(batch),
            "lllang": "ja", "format": "json", "lllimit": 500, "redirects": 1})
        norm = {n["from"]: n["to"] for n in d.get("query", {}).get("normalized", [])}
        redir = {r["from"]: r["to"] for r in d.get("query", {}).get("redirects", [])}
        by_title = {}
        for page in d["query"]["pages"].values():
            for ll in page.get("langlinks", []):
                by_title[page["title"]] = ll["*"]
        for orig in batch:
            t = redir.get(norm.get(orig, orig), norm.get(orig, orig))
            if t in by_title:
                out[orig] = by_title[t]
        time.sleep(0.6)
    return out


def fetch_extracts(titles):
    out = {}
    for i in range(0, len(titles), 20):
        batch = titles[i:i + 20]
        d = get_json("https://ja.wikipedia.org/w/api.php", {
            "action": "query", "maxlag": 5, "prop": "extracts", "exintro": 1, "explaintext": 1,
            "format": "json", "titles": "|".join(batch), "redirects": 1})
        for page in d.get("query", {}).get("pages", {}).values():
            if page.get("extract"):
                out[page["title"]] = page["extract"]
        time.sleep(0.6)
    return out


def clean(text):
    text = re.sub(r"（[^）]*）", "", text)
    text = re.sub(r"\([^)]*\)", "", text)
    return re.sub(r"\s+", "", text)


def sentences_for(title, extract):
    core = re.sub(r"（[^）]*）$", "", title).strip().split("・")[0].split(" ")[0]
    if len(core) < 2:
        return []
    got = []
    for s in clean(extract).split("。"):
        s = s.strip()
        if core in s and 8 <= len(s) <= 60:
            got.append(s)
        if len(got) >= 2:
            break
    return got


def main():
    out_path = sys.argv[1]
    pages = level4_pages()
    print("subpages:", len(pages), flush=True)

    by_header = {}   # header -> {en_title: None}
    for pg in pages:
        header = header_for(pg)
        for t in page_links(pg):
            by_header.setdefault(header, {})[t] = None
        print(f"  {pg}: total topics so far {sum(len(v) for v in by_header.values())}", flush=True)

    # 再開対応: 既に書かれたセクションはスキップ
    done_headers = set()
    if pathlib.Path(out_path).exists():
        for ln in pathlib.Path(out_path).read_text(encoding="utf-8").splitlines():
            if ln.startswith("# "):
                done_headers.add(ln.strip())
    mode = "a" if done_headers else "w"
    total_sents = 0
    with open(out_path, mode, encoding="utf-8") as f:
        for header, en_map in by_header.items():
            if header in done_headers:
                print(f"SKIP done section {header}", flush=True)
                continue
            en_titles = list(en_map)
            ja_map = langlinks_ja(en_titles)
            ja_titles = list(dict.fromkeys(ja_map.values()))
            extracts = fetch_extracts(ja_titles)
            lines = []
            for ja in ja_titles:
                if ja in extracts:
                    lines += sentences_for(ja, extracts[ja])
            f.write(header + "\n")
            f.write("\n".join(lines) + "\n")
            f.flush()
            total_sents += len(lines)
            print(f"{header}: en {len(en_titles)} -> ja {len(ja_titles)} -> sentences {len(lines)}", flush=True)
    print(f"DONE {out_path}: +{total_sents} sentences this run")


if __name__ == "__main__":
    main()
