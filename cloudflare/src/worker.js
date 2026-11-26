// Synaptic AI — Cloudflare Workers 版
// 体を持たないシナプス型自律AIの「連絡手段＋管理画面」Webアプリ。
//
// ストレージはアダプタ層の後ろに隠してある。後から外部ストレージ
// （R2 / KV / 独自APIなど）に差し替える場合は、同じメソッドを持つ
// クラスを1つ追加して createStore() の分岐に足すだけでよい。
import { HTML } from "./ui.js";

/* ================= ストレージアダプタ =================
   インターフェース（全実装が同じメソッドを持つこと）:
     loadBrain():          Promise<object|null>  全状態の読み込み
     saveBrain(brain):     Promise<void>         全状態の保存
     saveSnapshot(n, edges): Promise<void>
     loadSnapshot(n):      Promise<object|null>  edges を返す
     listSnapshots():      Promise<string[]>
====================================================== */
// v2シャード分割ストレージ:
//   v2:meta {guard, guardSeq, expSeq, auto, k, logChunks}
//   v2:e:<i> 接続（送信元ノードのハッシュで分割）
//   v2:f:<i> 分野タグ（同じ分割）
//   v2:l:<j> 経験ログ（1000件ずつ）
// 旧形式（"brain" 1行）は読み取り互換を保ち、保存時に v2 へ移行する。
function shardHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const SHARD_TARGET = 350000; // 1行あたりの目標バイト数
const LOG_CHUNK = 1000;

let BRAIN_CACHE = { rev: -1, brain: null };

class D1Store {
  constructor(db) { this.db = db; }
  async _ensure() {
    await this.db.prepare(
      "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    ).run();
  }
  async _get(key) {
    const raw = await this._getRaw(key);
    return raw === null ? null : JSON.parse(raw);
  }
  async _getRaw(key) {
    await this._ensure();
    const row = await this.db.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    if (!row) return null;
    if (!this._written) this._written = new Map();
    this._written.set(key, row.value);
    return row.value;
  }
  async _set(key, value) {
    await this._ensure();
    await this.db.prepare(
      "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(key, JSON.stringify(value)).run();
  }
  async _del(key) {
    await this.db.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
  }
  async _keysLike(prefix) {
    await this._ensure();
    const res = await this.db.prepare("SELECT key FROM kv_store WHERE key LIKE ?").bind(prefix + "%").all();
    return (res.results || []).map((r) => r.key);
  }
  async _batchSet(entries) {
    await this._ensure();
    for (let i = 0; i < entries.length; i += 50) {
      const part = entries.slice(i, i + 50);
      await this.db.batch(part.map(([k, v]) => this.db.prepare(
        "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).bind(k, v)));
    }
  }
  _splitEdges(edges) {
    let edgeCount = 0;
    for (const nbrs of Object.values(edges)) edgeCount += Object.keys(nbrs).length;
    const approx = edgeCount * 55;
    const k = Math.max(1, Math.min(64, Math.ceil(approx / SHARD_TARGET)));
    const shards = Array.from({ length: k }, () => ({}));
    for (const [node, nbrs] of Object.entries(edges)) shards[shardHash(node) % k][node] = nbrs;
    return shards;
  }
  async loadBrain() {
    const meta = await this._get("v2:meta");
    if (!meta) return this._get("brain"); // 旧形式（移行前）
    if (BRAIN_CACHE.brain && BRAIN_CACHE.rev === meta.rev) return BRAIN_CACHE.brain;
    const edges = {}, fields = {}, log = [];
    const jobs = [];
    for (let i = 0; i < meta.k; i++) {
      jobs.push(this._get("v2:e:" + i).then((s) => { if (s) Object.assign(edges, s); }));
      jobs.push(this._get("v2:f:" + i).then((s) => { if (s) Object.assign(fields, s); }));
    }
    for (let j = 0; j < meta.logChunks; j++) {
      jobs.push(this._get("v2:l:" + j).then((arr) => { if (arr) log.push(...arr); }));
    }
    await Promise.all(jobs);
    log.sort((a, b) => a.id - b.id);
    const brain = { edges, fields, log, guard: meta.guard, guardSeq: meta.guardSeq, expSeq: meta.expSeq, auto: meta.auto };
    BRAIN_CACHE = { rev: meta.rev || 0, brain };
    return brain;
  }
  async saveBrain(brain) {
    const rev = (BRAIN_CACHE.rev || 0) + 1;
    const eShards = this._splitEdges(brain.edges);
    const k = eShards.length;
    const fShards = Array.from({ length: k }, () => ({}));
    for (const [node, f] of Object.entries(brain.fields || {})) fShards[shardHash(node) % k][node] = f;
    const logChunks = Math.max(1, Math.ceil(brain.log.length / LOG_CHUNK));
    const entries = [];
    entries.push(["v2:meta", JSON.stringify({ guard: brain.guard, guardSeq: brain.guardSeq, expSeq: brain.expSeq, auto: brain.auto, k, logChunks, rev })]);
    eShards.forEach((s, i) => entries.push(["v2:e:" + i, JSON.stringify(s)]));
    fShards.forEach((s, i) => entries.push(["v2:f:" + i, JSON.stringify(s)]));
    for (let j = 0; j < logChunks; j++) entries.push(["v2:l:" + j, JSON.stringify(brain.log.slice(j * LOG_CHUNK, (j + 1) * LOG_CHUNK))]);
    if (!this._written) this._written = new Map();
    const dirty = entries.filter(([key, val]) => this._written.get(key) !== val);
    await this._batchSet(dirty);
    for (const [key, val] of dirty) this._written.set(key, val);
    BRAIN_CACHE = { rev, brain };
    // 旧シャードの残りと旧形式を掃除
    const stale = (await this._keysLike("v2:")).filter((key) => !entries.some(([k2]) => k2 === key));
    for (const key of stale) await this._del(key);
    await this._del("brain");
  }
  async saveSnapshot(name, edges) {
    const shards = this._splitEdges(edges);
    const entries = [["snap2:" + name + ":meta", JSON.stringify({ k: shards.length })]];
    shards.forEach((s, i) => entries.push(["snap2:" + name + ":e:" + i, JSON.stringify(s)]));
    await this._batchSet(entries);
    await this._del("snap:" + name);
  }
  async loadSnapshot(name) {
    const meta = await this._get("snap2:" + name + ":meta");
    if (!meta) return this._get("snap:" + name);
    const edges = {};
    const jobs = [];
    for (let i = 0; i < meta.k; i++) jobs.push(this._get("snap2:" + name + ":e:" + i).then((s) => { if (s) Object.assign(edges, s); }));
    await Promise.all(jobs);
    return edges;
  }
  async listSnapshots() {
    const names = new Set();
    for (const key of await this._keysLike("snap:")) names.add(key.slice(5));
    for (const key of await this._keysLike("snap2:")) {
      const rest = key.slice(6);
      if (rest.endsWith(":meta")) names.add(rest.slice(0, -5));
    }
    return [...names].sort();
  }
}

class MemoryStore {
  constructor() { this.map = new Map(); }
  async loadBrain() { return this.map.get("brain") || null; }
  async saveBrain(brain) { this.map.set("brain", brain); }
  async saveSnapshot(name, edges) { this.map.set("snap:" + name, edges); }
  async loadSnapshot(name) { return this.map.get("snap:" + name) || null; }
  async listSnapshots() {
    return [...this.map.keys()].filter((k) => k.startsWith("snap:")).map((k) => k.slice(5)).sort();
  }
}

// 後から外部ストレージを接続する場合は、ここに分岐を足す。
let _memStore = null;
function createStore(env) {
  if (env.DB) return new D1Store(env.DB);
  if (!_memStore) _memStore = new MemoryStore();
  return _memStore;
}

/* ================= シナプスコア（JS移植） ================= */
const DECAY = 0.02, LR = 0.15;

const FIELD_KEYS = ["science", "animals", "food", "body", "emotion", "society", "tech", "transport", "geography", "time", "life", "culture", "abstract", "self", "general"];
function dominantField(fields, node) {
  const f = fields ? fields[node] : null;
  if (!f) return null;
  let best = null, bestC = 1;
  for (const [k, c] of Object.entries(f)) if (c > bestC) { bestC = c; best = k; }
  return best;
}
function tagTokens(brain, tokens, field) {
  if (!field || !FIELD_KEYS.includes(field)) return;
  for (const tk of tokens) {
    const m = brain.fields[tk] || (brain.fields[tk] = {});
    m[field] = (m[field] || 0) + 1;
  }
}
function inferField(brain, tokens) {
  const agg = {};
  for (const tk of tokens) {
    const f = brain.fields[tk];
    if (f) for (const [k, c] of Object.entries(f)) agg[k] = (agg[k] || 0) + c;
  }
  let best = null, bestC = 1;
  for (const [k, c] of Object.entries(agg)) if (c > bestC) { bestC = c; best = k; }
  return best;
}
function gateFactor(fields, u, v) {
  if (!fields) return 1.0;
  const fu = dominantField(fields, u), fv = dominantField(fields, v);
  return fu && fv && fu !== fv ? 0.4 : 1.0;
}
function activate(edges, seeds, depth = 2, threshold = 0.05, fields = null) {
  const act = { ...seeds };
  let frontier = { ...seeds };
  for (let d = 0; d < depth; d++) {
    const nxt = {};
    for (const [node, a] of Object.entries(frontier)) {
      for (const [nb, e] of Object.entries(edges[node] || {})) {
        nxt[nb] = (nxt[nb] || 0) + a * e.w * gateFactor(fields, node, nb);
      }
    }
    frontier = {};
    for (const [n, v] of Object.entries(nxt)) {
      if (v >= threshold && v > (act[n] || 0)) { frontier[n] = Math.round(v * 10000) / 10000; act[n] = frontier[n]; }
    }
    if (!Object.keys(frontier).length) break;
  }
  return act;
}

function learn(edges, activated, reward = 1.0) {
  const nodes = Object.entries(activated).filter(([, a]) => a > 0);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [a, aa] = nodes[i], [b, ab] = nodes[j];
      const gain = LR * aa * ab * reward;
      for (const [x, y] of [[a, b], [b, a]]) {
        edges[x] = edges[x] || {};
        const e = edges[x][y] || (edges[x][y] = { w: 0, imp: 0 });
        e.w += gain * (1 - Math.min(e.imp, 0.9));
        e.w = Math.max(-1, Math.min(1, e.w));
        if (reward > 0) e.imp = Math.min(1, e.imp + Math.abs(gain) * 0.1);
      }
    }
  }
}

function decayAll(edges) {
  let pruned = 0;
  for (const a of Object.keys(edges)) {
    for (const b of Object.keys(edges[a])) {
      const e = edges[a][b];
      e.w -= DECAY * (1 - e.imp) * Math.abs(e.w);
      if (Math.abs(e.w) < 0.01 && e.imp < 0.1) { delete edges[a][b]; pruned++; }
    }
    if (!Object.keys(edges[a]).length) delete edges[a];
  }
  return pruned;
}

// 自動学習の中核: 経験リプレイ（報酬が正のチャットを弱く再学習）→ 忘却・剪定 → 自動スナップショット
async function consolidateBrain(store, brain, isAuto) {
  for (const rec of brain.log.slice(-200)) {
    if (rec.action !== "chat" || !(rec.reward > 0)) continue;
    const toks = (rec.in || []).filter((s) => typeof s === "string");
    if (toks.length > 1) learn(brain.edges, Object.fromEntries(toks.map((x) => [x, 1.0])), 0.15 * rec.reward);
  }
  const pruned = decayAll(brain.edges);
  const name = "auto-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  await store.saveSnapshot(name, brain.edges);
  if (isAuto) brain.auto.runs += 1;
  brain.auto.lastAt = Date.now() / 1000;
  brain.auto.lastSeq = brain.expSeq;
  addLog(brain, [], isAuto ? "auto_consolidate" : "consolidate", `replay+decay pruned=${pruned}`, 0);
  return { pruned, snapshot: name };
}

// 経験ログに保存された文の中から、シードと活性に最も合う文を想起する
function endPunct(s) {
  if (/[。.!?]$/.test(s)) return s;
  return /[a-zA-Z0-9]$/.test(s) ? s + "." : s + "。";
}
function retrieveSentences(brain, seeds, activated, excludeText) {
  const seen = new Set(), scored = [];
  for (const rec of brain.log) {
    if (rec.action !== "chat") continue;
    const text = rec.result;
    if (!text || text === excludeText || seen.has(text) || /[?？]\s*$/.test(text)) continue;
    seen.add(text);
    const toks = Array.isArray(rec.in) ? rec.in.filter((x) => typeof x === "string") : [];
    let score = 0, seedHit = 0;
    for (const tk of toks) {
      if (tk in seeds) { score += 2; seedHit++; }
      else if (activated[tk]) score += activated[tk];
    }
    if (seedHit >= 1 && score >= 2) scored.push([score, text]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored;
}

function stats(edges) {
  const nodes = new Set(Object.keys(edges));
  let count = 0, sum = 0;
  for (const nbrs of Object.values(edges)) {
    for (const [b, e] of Object.entries(nbrs)) { nodes.add(b); count++; sum += Math.abs(e.w); }
  }
  return { nodes: nodes.size, edges: count / 2, avg_weight: count ? Math.round((sum / count) * 10000) / 10000 : 0 };
}

function graph(edges, limit = 200) {
  const seen = new Set(), flat = [], nodes = new Set(), links = [];
  for (const [a, nbrs] of Object.entries(edges)) {
    for (const [b, e] of Object.entries(nbrs)) {
      const key = [a, b].sort().join(" ");
      if (seen.has(key)) continue;
      seen.add(key); flat.push([Math.abs(e.w), a, b, e]);
    }
  }
  flat.sort((x, y) => y[0] - x[0]);
  for (const [, a, b, e] of flat.slice(0, limit)) {
    nodes.add(a); nodes.add(b);
    links.push({ source: a, target: b, w: Math.round(e.w * 1000) / 1000, imp: Math.round(e.imp * 1000) / 1000 });
  }
  return { nodes: [...nodes].sort().map((id) => ({ id })), links };
}

/* ================= 分かち書き（簡易） ================= */
const STOP = new Set(["です", "ます", "した", "する", "ある", "いる", "なる", "こと", "もの", "これ", "それ", "あれ", "私", "僕"]);
const EN_STOP = new Set(["the","is","of","a","an","and","or","to","in","on","for","with","are","was","were","be","been","by","at","from","as","it","its","this","that","these","those","i","you","he","she","we","they","my","your","his","her","our","their","am","do","does","did","have","has","had","will","would","can","could","should","may","might","not","no","yes","if","but","so","than","then","when","where","which","who","what","how","all","any","each","into","over","under","about","between"]);
function tokenize(text) {
  const cleaned = text.replace(/[、。！？!?・「」『』（）()\[\],.:;'"\s]+/g, " ");
  const tokens = [];
  for (const chunk of cleaned.split(" ")) {
    for (let p of chunk.split(/は|が|を|に|へ|と|の|で|や|も|から|まで|より|けど|ので|のに/)) {
      p = p.trim();
      if (p && !STOP.has(p) && !EN_STOP.has(p.toLowerCase()) && p.length <= 20 && !tokens.includes(p)) tokens.push(p);
    }
  }
  return tokens.slice(0, 12);
}

const IRREVERSIBLE = ["送信して", "送って", "削除して", "消して", "公開して", "買って", "支払って", "投稿して", "send this", "send it", "delete this", "delete it", "publish this", "buy this", "pay for this"];

/* ================= 本体 ================= */
const defaultBrain = () => ({ edges: {}, log: [], guard: [], guardSeq: 0, expSeq: 0, fields: {}, auto: { enabled: true, lastAt: 0, lastSeq: 0, runs: 0 } });

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function requireAdmin(request, env) {
  if (env.ADMIN_TOKEN && request.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
    return json({ detail: "管理者トークンが必要です" }, 401);
  }
  return null;
}

function addLog(brain, inputs, action, result, reward) {
  brain.expSeq += 1;
  const rec = { id: brain.expSeq, t: Date.now() / 1000, in: inputs, action, result, reward };
  brain.log.push(rec);
  if (brain.log.length > 1000) brain.log = brain.log.slice(-1000);
  return rec;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const store = createStore(env);

    if (path === "/" && request.method === "GET") {
      return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (path === "/manifest.webmanifest") {
      return json({ name: "Synaptic AI", short_name: "Synaptic", start_url: "/", display: "standalone", background_color: "#f5f5f4", theme_color: "#111111", icons: [] });
    }
    if (!path.startsWith("/api/")) return new Response("not found", { status: 404 });

    const brain = (await store.loadBrain()) || defaultBrain();
    if (!brain.auto) brain.auto = { enabled: true, lastAt: 0, lastSeq: 0, runs: 0 };
    if (!brain.fields) brain.fields = {};

    // --- チャット（連絡手段） ---
    if (path === "/api/chat" && request.method === "POST") {
      const { message, field } = await request.json();
      const text = (message || "").trim();
      if (!text) return json({ detail: "message is empty" }, 400);

      if (IRREVERSIBLE.some((w) => text.includes(w))) {
        brain.guardSeq += 1;
        const item = { id: brain.guardSeq, action: "irreversible_request", detail: text, status: "pending", t: Date.now() / 1000 };
        brain.guard.push(item);
        addLog(brain, [text], "guard_blocked", `承認キュー #${item.id} に回送`, 0);
        await store.saveBrain(brain);
        return json({
          reply: `That action is irreversible, so I won't do it myself. I sent it to the approval queue (#${item.id}) in Admin. It will run if approved.`,
          activated: {}, guard_id: item.id,
        });
      }

      const tokens = tokenize(text);
      const seeds = Object.fromEntries(tokens.map((t) => [t, 1.0]));
      const activated = tokens.length ? activate(brain.edges, seeds, 2, 0.05, brain.fields) : {};
      const sents = tokens.length ? retrieveSentences(brain, seeds, activated, text) : [];
      const effField = FIELD_KEYS.includes(field) ? field : inferField(brain, tokens);
      const recalled = Object.entries(activated).filter(([n]) => !(n in seeds)).sort((a, b) => b[1] - a[1]);
      if (tokens.length) learn(brain.edges, seeds, 0.6);
      tagTokens(brain, tokens, effField);
      const rec = addLog(brain, tokens, "chat", text, 0.6);
      if (brain.auto.enabled && brain.expSeq - brain.auto.lastSeq >= 30) await consolidateBrain(store, brain, true);
      await store.saveBrain(brain);

      let reply;
      if (sents.length) {
        reply = endPunct(sents[0][1]);
        if (sents.length > 1 && sents[1][0] >= 1.0) reply += " " + endPunct(sents[1][1]);
      }
      else if (recalled.length) reply = `Recalled: ${recalled.slice(0, 5).map(([n]) => n).join(", ")}`;
      else if (tokens.length) reply = "Learned.";
      else reply = "I could not break that into words.";
      return json({ reply, activated, experience_id: rec.id, field: effField });
    }

    // --- フィードバック（報酬信号） ---
    if (path === "/api/feedback" && request.method === "POST") {
      const { experience_id, value } = await request.json();
      const rec = brain.log.find((r) => r.id === experience_id);
      if (!rec) return json({ detail: "experience not found" }, 404);
      const tokens = rec.in.filter((t) => typeof t === "string");
      if (tokens.length) learn(brain.edges, Object.fromEntries(tokens.map((t) => [t, 1.0])), value * 0.8);
      addLog(brain, tokens, "feedback", `exp#${experience_id} -> ${value}`, value);
      await store.saveBrain(brain);
      return json({ ok: true, stats: stats(brain.edges) });
    }

    // --- 管理画面用 ---
    if (path === "/api/memory/graph") {
      const g = graph(brain.edges);
      for (const n of g.nodes) n.field = dominantField(brain.fields, n.id);
      return json(g);
    }
    if (path === "/api/experience") {
      const limit = Number(url.searchParams.get("limit") || 50);
      return json(brain.log.slice(-limit).reverse());
    }
    if (path === "/api/metrics") {
      const fieldSummary = {};
      for (const node of Object.keys(brain.fields)) { const df = dominantField(brain.fields, node); if (df) fieldSummary[df] = (fieldSummary[df] || 0) + 1; }
      return json({ ...stats(brain.edges), experience_count: brain.expSeq, guard_pending: brain.guard.filter((g) => g.status === "pending").length, auto_learn: brain.auto.enabled, auto_runs: brain.auto.runs, last_auto_at: brain.auto.lastAt, fields: fieldSummary });
    }
    if (path === "/api/consolidate" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { pruned, snapshot } = await consolidateBrain(store, brain, false);
      await store.saveBrain(brain);
      return json({ ok: true, pruned_edges: pruned, snapshot, stats: stats(brain.edges) });
    }
    if (path === "/api/fields/backfill" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { items } = await request.json();
      let tagged = 0;
      for (const it of items || []) {
        if (!it || !FIELD_KEYS.includes(it.field) || !it.text) continue;
        const toks = tokenize(it.text);
        tagTokens(brain, toks, it.field);
        tagged += toks.length;
      }
      await store.saveBrain(brain);
      return json({ ok: true, tagged });
    }
    if (path === "/api/prune" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { threshold = 0.03 } = await request.json().catch(() => ({}));
      let removed = 0;
      for (const a of Object.keys(brain.edges)) {
        for (const b of Object.keys(brain.edges[a])) {
          const e = brain.edges[a][b];
          if (Math.abs(e.w) < threshold && e.imp < 0.5) { delete brain.edges[a][b]; removed++; }
        }
        if (!Object.keys(brain.edges[a]).length) delete brain.edges[a];
      }
      await store.saveBrain(brain);
      return json({ ok: true, removed, threshold, ...stats(brain.edges) });
    }
    if (path === "/api/teach/bulk" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { items } = await request.json();
      let learned = 0, skipped = 0;
      for (const it of (items || []).slice(0, 1000)) {
        const text = (it && it.message ? String(it.message) : "").trim();
        if (!text) { skipped++; continue; }
        const tokens = tokenize(text);
        if (!tokens.length) { skipped++; continue; }
        const seeds = Object.fromEntries(tokens.map((x) => [x, 1.0]));
        learn(brain.edges, seeds, 0.6);
        const effField = FIELD_KEYS.includes(it.field) ? it.field : inferField(brain, tokens);
        tagTokens(brain, tokens, effField);
        addLog(brain, tokens, "chat", text, 0.6);
        learned++;
        if (learned % 500 === 0) decayAll(brain.edges);
      }
      await store.saveBrain(brain);
      return json({ ok: true, learned, skipped });
    }
    if (path === "/api/settings" && request.method === "GET") {
      return json({ auto_learn: brain.auto.enabled, auto_runs: brain.auto.runs, last_auto_at: brain.auto.lastAt });
    }
    if (path === "/api/settings" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { auto_learn } = await request.json();
      brain.auto.enabled = !!auto_learn;
      addLog(brain, [], "settings", `auto_learn=${brain.auto.enabled}`, 0);
      await store.saveBrain(brain);
      return json({ ok: true, auto_learn: brain.auto.enabled });
    }
    if (path === "/api/snapshots" && request.method === "GET") return json(await store.listSnapshots());
    if (path === "/api/snapshot" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { name } = await request.json();
      const safe = (name || "snapshot").replace(/[^\w\-]/g, "_");
      await store.saveSnapshot(safe, brain.edges);
      return json({ ok: true, name: safe });
    }
    const restoreMatch = path.match(/^\/api\/snapshot\/(.+)\/restore$/);
    if (restoreMatch && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const edges = await store.loadSnapshot(decodeURIComponent(restoreMatch[1]));
      if (!edges) return json({ detail: "snapshot not found" }, 404);
      brain.edges = edges;
      addLog(brain, [], "restore", restoreMatch[1], 0);
      await store.saveBrain(brain);
      return json({ ok: true, stats: stats(brain.edges) });
    }
    if (path === "/api/guard" && request.method === "GET") return json([...brain.guard].reverse());
    const decideMatch = path.match(/^\/api\/guard\/(\d+)\/decide$/);
    if (decideMatch && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const item = brain.guard.find((g) => g.id === Number(decideMatch[1]) && g.status === "pending");
      if (!item) return json({ detail: "pending item not found" }, 404);
      item.status = url.searchParams.get("approve") === "true" ? "approved" : "rejected";
      addLog(brain, [], "guard_decide", `#${item.id} -> ${item.status}`, 0);
      await store.saveBrain(brain);
      return json({ ok: true, item });
    }

    return json({ detail: "not found" }, 404);
  },

  // Cron 起動: 自動学習が ON なら定期的にリプレイ＋定着を実行する
  async scheduled(event, env, ctx) {
    const store = createStore(env);
    const brain = (await store.loadBrain()) || defaultBrain();
    if (!brain.auto) brain.auto = { enabled: true, lastAt: 0, lastSeq: 0, runs: 0 };
    if (!brain.fields) brain.fields = {};
    if (!brain.auto.enabled) return;
    await consolidateBrain(store, brain, true);
    await store.saveBrain(brain);
  },
};
