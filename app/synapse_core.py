"""シナプス型継続学習コア（GPU不要・標準ライブラリのみ）

設計方針:
- シナプスは3種に分ける思想を、重み(w)と重要度(imp)で表現する。
  imp が高い接続ほど学習で上書きされにくく、忘却でも弱まりにくい。
- 学習は局所ルール（ヘブ則＋報酬変調）。全体の逆伝播は行わない。
- 経験は追記専用ログに残し、スナップショットでいつでも戻せる。
"""
import json
import time
from collections import defaultdict


class SynapticMemory:
    def __init__(self, decay=0.02, lr=0.15):
        self.edges = defaultdict(dict)  # edges[a][b] = {"w": float, "imp": float}
        self.decay = decay
        self.lr = lr
        self.last_seen = {}

    # ---------- 活性化（連想） ----------
    def activate(self, seeds, depth=2, threshold=0.05):
        """seeds: {node: activation} から接続を伝って関連ノードを活性化する。"""
        act = dict(seeds)
        frontier = dict(seeds)
        for _ in range(depth):
            nxt = defaultdict(float)
            for node, a in frontier.items():
                for nb, e in self.edges.get(node, {}).items():
                    nxt[nb] += a * e["w"]
            frontier = {
                n: round(v, 4)
                for n, v in nxt.items()
                if v >= threshold and v > act.get(n, 0)
            }
            act.update(frontier)
            if not frontier:
                break
        now = time.time()
        for n in act:
            self.last_seen[n] = now
        return act

    # ---------- 学習（ヘブ則＋報酬変調） ----------
    def learn(self, activated, reward=1.0):
        """同時に活性化したノード同士の接続を、報酬に応じて強める/弱める。"""
        nodes = [(n, a) for n, a in activated.items() if a > 0]
        for i, (a, aa) in enumerate(nodes):
            for b, ab in nodes[i + 1:]:
                gain = self.lr * aa * ab * reward
                for x, y in ((a, b), (b, a)):
                    e = self.edges[x].setdefault(y, {"w": 0.0, "imp": 0.0})
                    e["w"] += gain * (1.0 - min(e["imp"], 0.9))
                    e["w"] = max(-1.0, min(1.0, e["w"]))
                    if reward > 0:
                        e["imp"] = min(1.0, e["imp"] + abs(gain) * 0.1)

    # ---------- 忘却・剪定（睡眠バッチから呼ぶ） ----------
    def decay_all(self):
        pruned = 0
        for a in list(self.edges.keys()):
            for b in list(self.edges[a].keys()):
                e = self.edges[a][b]
                e["w"] -= self.decay * (1.0 - e["imp"]) * abs(e["w"])
                if abs(e["w"]) < 0.01 and e["imp"] < 0.1:
                    del self.edges[a][b]
                    pruned += 1
            if not self.edges[a]:
                del self.edges[a]
        return pruned

    # ---------- 統計 ----------
    def stats(self):
        nodes = set(self.edges.keys())
        edge_count = 0
        w_sum = 0.0
        for nbrs in self.edges.values():
            nodes.update(nbrs.keys())
            edge_count += len(nbrs)
            w_sum += sum(abs(e["w"]) for e in nbrs.values())
        return {
            "nodes": len(nodes),
            "edges": edge_count // 2,
            "avg_weight": round(w_sum / edge_count, 4) if edge_count else 0.0,
        }

    def graph(self, limit=200):
        """管理画面の可視化用にグラフを返す（強い接続を優先）。"""
        seen = set()
        links = []
        nodes = set()
        flat = []
        for a, nbrs in self.edges.items():
            for b, e in nbrs.items():
                key = tuple(sorted((a, b)))
                if key in seen:
                    continue
                seen.add(key)
                flat.append((abs(e["w"]), a, b, e))
        flat.sort(reverse=True)
        for _, a, b, e in flat[:limit]:
            nodes.add(a)
            nodes.add(b)
            links.append(
                {"source": a, "target": b, "w": round(e["w"], 3), "imp": round(e["imp"], 3)}
            )
        return {"nodes": [{"id": n} for n in sorted(nodes)], "links": links}

    # ---------- 保存／復元 ----------
    def to_dict(self):
        return {a: dict(nbrs) for a, nbrs in self.edges.items()}

    def from_dict(self, data):
        self.edges = defaultdict(dict, {a: dict(n) for a, n in data.items()})

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False)

    def load(self, path):
        with open(path, encoding="utf-8") as f:
            self.from_dict(json.load(f))


class ExperienceLog:
    """追記専用の経験ログ。シナプスが壊れてもここから再生できる。"""

    def __init__(self, path):
        self.path = path
        self._seq = 0
        try:
            with open(path, encoding="utf-8") as f:
                self._seq = sum(1 for _ in f)
        except FileNotFoundError:
            pass

    def add(self, inputs, action, result, reward):
        self._seq += 1
        rec = {
            "id": self._seq,
            "t": time.time(),
            "in": inputs,
            "action": action,
            "result": result,
            "reward": reward,
        }
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return rec

    def recent(self, limit=50):
        try:
            with open(self.path, encoding="utf-8") as f:
                lines = f.readlines()
        except FileNotFoundError:
            return []
        out = []
        for line in lines[-limit:]:
            line = line.strip()
            if line:
                out.append(json.loads(line))
        return list(reversed(out))

    def get(self, rec_id):
        try:
            with open(self.path, encoding="utf-8") as f:
                for line in f:
                    rec = json.loads(line)
                    if rec["id"] == rec_id:
                        return rec
        except FileNotFoundError:
            pass
        return None
