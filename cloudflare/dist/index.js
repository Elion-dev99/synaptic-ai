// WebアプリのUI（管理画面＋連絡チャット）。public/index.html と同じ内容。
const HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Synaptic AI</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="data:,">
<meta name="theme-color" content="#111111">
<style>
  :root{
    --bg:#f5f5f4; --surface:#ffffff; --ink:#171717; --muted:#6b7280;
    --line:#e5e5e0; --accent:#111111; --chip:#eef2ff; --chip-ink:#3730a3;
    --ok:#047857; --ng:#b91c1c; --nav-h:58px;
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#0c0c0d; --surface:#17181a; --ink:#f3f4f6; --muted:#9ca3af;
      --line:#26272b; --accent:#f3f4f6; --chip:#1e1b4b; --chip-ink:#c7d2fe; }
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;background:var(--bg);color:var(--ink)}
  header{position:sticky;top:0;background:var(--surface);border-bottom:1px solid var(--line);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;z-index:5}
  header h1{font-size:16px;margin:0;font-weight:700;letter-spacing:.02em}
  #metrics{font-size:12px;color:var(--muted);text-align:right;line-height:1.5}
  main{max-width:880px;margin:0 auto;padding:16px 12px 150px}
  section{display:none} section.on{display:block}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
  .card h2{font-size:14px;margin:0 0 10px}
  /* bottom nav */
  #tabbar{position:fixed;left:0;right:0;bottom:0;height:calc(var(--nav-h) + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:var(--surface);border-top:1px solid var(--line);display:flex;z-index:10}
  #tabbar button{flex:1;background:transparent;border:none;color:var(--muted);font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:6px 0}
  #tabbar button .ic{font-size:19px;line-height:1}
  #tabbar button.on{color:var(--ink);font-weight:700}
  /* chat */
  #chatlog{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
  .msg{max-width:85%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
  .msg.user{align-self:flex-end;background:var(--accent);color:var(--bg);border-bottom-right-radius:4px}
  .msg.ai{align-self:flex-start;background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:4px}
  .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
  .chip{background:var(--chip);color:var(--chip-ink);font-size:11px;padding:2px 8px;border-radius:999px}
  .fb{display:flex;gap:6px;margin-top:7px}
  .fb button{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:999px;font-size:11px;padding:3px 10px;cursor:pointer}
  #composer{position:fixed;left:0;right:0;bottom:calc(var(--nav-h) + env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--line);padding:10px 12px;display:none}
  #composer .row{max-width:880px;margin:0 auto;display:flex;gap:8px}
  #composer input{flex:1;border:1px solid var(--line);border-radius:999px;padding:11px 15px;font-size:15px;background:var(--bg);color:var(--ink)}
  #composer button{background:var(--accent);color:var(--bg);border:none;border-radius:999px;padding:0 20px;font-size:14px;cursor:pointer}
  /* lists */
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border-bottom:1px solid var(--line);padding:6px 4px;text-align:left;vertical-align:top}
  .btn{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:9px;padding:7px 12px;font-size:13px;cursor:pointer}
  .btn.primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}
  .btn.ok{color:var(--ok)} .btn.ng{color:var(--ng)}
  input.txt{border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:13px;background:var(--bg);color:var(--ink);width:100%}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  .stat{background:var(--bg);border-radius:10px;padding:10px}
  .stat b{font-size:20px;display:block}
  .stat span{font-size:11px;color:var(--muted)}
  canvas{width:100%;height:420px;background:var(--bg);border-radius:10px;touch-action:none}
  .muted{color:var(--muted);font-size:12px;line-height:1.7}
  .rowflex{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
</style>
</head>
<body>
<header>
  <h1>Synaptic AI</h1>
  <div id="metrics">…</div>
</header>
<main>
  <section id="tab-home" class="on">
    <div class="card">
      <h2>状態</h2>
      <div class="grid" id="homeStats"></div>
    </div>
    <div class="card">
      <h2>最近の経験</h2>
      <div id="homeRecent"></div>
    </div>
  </section>

  <section id="tab-chat">
    <div id="chatlog"></div>
  </section>

  <section id="tab-graph">
    <div class="card">
      <h2>記憶グラフ（立体）</h2>
      <canvas id="graphCanvas" width="800" height="420"></canvas>
      <div class="rowflex" style="margin-top:10px;justify-content:space-between">
        <span class="muted">ドラッグで回転</span>
        <button class="btn" onclick="loadGraph()">再読み込み</button>
      </div>
    </div>
  </section>

  <section id="tab-log">
    <div class="card">
      <h2>経験ログ</h2>
      <div id="logTable"></div>
      <button class="btn" onclick="loadLog()" style="margin-top:10px">再読み込み</button>
    </div>
  </section>

  <section id="tab-admin">
    <div class="card">
      <h2>状態</h2>
      <div class="grid" id="statGrid"></div>
    </div>
    <div class="card">
      <h2>自動学習</h2>
      <div class="rowflex" style="justify-content:space-between">
        <span id="autoState">…</span>
        <button class="btn" onclick="toggleAuto()">切り替え</button>
      </div>
      <div id="autoDetail" class="muted" style="margin-top:6px"></div>
    </div>
    <div class="card">
      <h2>承認キュー</h2>
      <div id="guardList"></div>
    </div>
    <div class="card">
      <h2>スナップショット / 睡眠</h2>
      <div class="rowflex">
        <input class="txt" id="snapName" placeholder="スナップショット名" style="max-width:220px">
        <button class="btn primary" onclick="takeSnapshot()">保存する</button>
        <button class="btn" onclick="consolidate()">睡眠（忘却・剪定＋自動保存）</button>
      </div>
      <div id="snapList" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <h2>管理者トークン</h2>
      <input class="txt" id="adminToken" type="password" placeholder="ADMIN_TOKEN">
    </div>
  </section>
</main>

<div id="composer">
  <div class="row">
    <input id="msgInput" placeholder="メッセージ" autocomplete="off">
    <button onclick="sendMsg()">送信</button>
  </div>
</div>

<nav id="tabbar">
  <button data-tab="home" class="on" onclick="switchTab('home')"><span class="ic">⌂</span>ホーム</button>
  <button data-tab="chat" onclick="switchTab('chat')"><span class="ic">❝</span>チャット</button>
  <button data-tab="graph" onclick="switchTab('graph')"><span class="ic">◉</span>記憶</button>
  <button data-tab="log" onclick="switchTab('log')"><span class="ic">≡</span>ログ</button>
  <button data-tab="admin" onclick="switchTab('admin')"><span class="ic">⚙</span>管理</button>
</nav>

<script>
const $ = s => document.querySelector(s);
const store = {
  get(k){ try { return localStorage.getItem(k) || ''; } catch(e){ return ''; } },
  set(k,v){ try { localStorage.setItem(k, v); } catch(e){} }
};
const token = () => store.get('admin_token');
try {
  $('#adminToken').value = token();
  $('#adminToken').addEventListener('change', e => store.set('admin_token', e.target.value));
} catch(e){}
const adminHeaders = () => ({'Content-Type':'application/json','X-Admin-Token': token()});

function switchTab(name){
  document.querySelectorAll('#tabbar button').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id === 'tab-' + name));
  $('#composer').style.display = name === 'chat' ? 'block' : 'none';
  if (name !== 'graph' && gAnim) { cancelAnimationFrame(gAnim); gAnim = null; }
  if (name === 'home') loadHome();
  if (name === 'graph') loadGraph();
  if (name === 'log') loadLog();
  if (name === 'admin') loadAdmin();
  window.scrollTo(0, 0);
}
document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function statCards(m){
  return [['ノード',m.nodes],['接続',m.edges],['平均の強さ',m.avg_weight],['経験の総数',m.experience_count],['承認待ち',m.guard_pending]]
    .map(([k,v]) => '<div class="stat"><b>'+v+'</b><span>'+k+'</span></div>').join('');
}
async function loadHome(){
  const m = await refreshMetrics();
  $('#homeStats').innerHTML = statCards(m);
  const rows = await (await fetch('/api/experience?limit=5')).json();
  $('#homeRecent').innerHTML = rows.length ? '<table>' + rows.map(r =>
    '<tr><td>'+new Date(r.t*1000).toLocaleTimeString('ja-JP')+'</td><td>'+r.action+'</td><td>'+String(r.result).slice(0,40)+'</td></tr>').join('') + '</table>'
    : '<p class="muted">まだありません。</p>';
}

function addMsg(text, who, activated, expId){
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  if (who === 'ai' && activated && Object.keys(activated).length){
    const c = document.createElement('div'); c.className = 'chips';
    Object.entries(activated).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([n,v])=>{
      const s = document.createElement('span'); s.className='chip'; s.textContent = n + ' ' + v.toFixed(2); c.appendChild(s);
    });
    d.appendChild(c);
  }
  if (who === 'ai' && expId){
    const f = document.createElement('div'); f.className='fb';
    [['良い',1],['悪い',-1]].forEach(([label,v])=>{
      const btn = document.createElement('button'); btn.textContent = label;
      btn.onclick = async () => {
        await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({experience_id:expId,value:v})});
        btn.textContent = label + ' ✓'; refreshMetrics();
      };
      f.appendChild(btn);
    });
    d.appendChild(f);
  }
  $('#chatlog').appendChild(d);
  window.scrollTo(0, document.body.scrollHeight);
}

async function sendMsg(){
  const inp = $('#msgInput'); const text = inp.value.trim(); if(!text) return;
  inp.value=''; addMsg(text,'user');
  const r = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
  const j = await r.json();
  addMsg(j.reply,'ai',j.activated,j.experience_id);
  refreshMetrics();
}
$('#msgInput').addEventListener('keydown', e => { if(e.key==='Enter') sendMsg(); });

async function refreshMetrics(){
  const m = await (await fetch('/api/metrics')).json();
  $('#metrics').innerHTML = 'ノード ' + m.nodes + ' ／ 接続 ' + m.edges + '<br>経験 ' + m.experience_count + ' ／ 承認待ち ' + m.guard_pending;
  return m;
}

// ---- 記憶グラフ（立体）: 3D配置→回転→透視投影で描く ----
let g3d = null, gAnim = null;
function hash3(s){ let h = 2166136261; for (const c of s){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
async function loadGraph(){
  const g = await (await fetch('/api/memory/graph')).json();
  const cv = $('#graphCanvas');
  if (!g.nodes.length){
    const ctx = cv.getContext('2d'); cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted');
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('まだ記憶がありません', cv.width/2, cv.height/2); g3d = null; return;
  }
  const deg = {}; g.links.forEach(l => { deg[l.source] = (deg[l.source]||0)+1; deg[l.target] = (deg[l.target]||0)+1; });
  const nodes = g.nodes.map(n => {
    const t = hash3(n.id) * Math.PI * 2, ph = Math.acos(2 * hash3(n.id + '#') - 1);
    return { id: n.id, act: n.activation || 0, deg: deg[n.id] || 0,
             x: Math.sin(ph) * Math.cos(t), y: Math.cos(ph), z: Math.sin(ph) * Math.sin(t) };
  });
  const idx = {}; nodes.forEach(n => idx[n.id] = n);
  g3d = { nodes, links: g.links.filter(l => idx[l.source] && idx[l.target]).map(l => ({ a: idx[l.source], b: idx[l.target], w: typeof l.w === 'number' ? l.w : 0.3 })),
          ax: 0.5, ay: 0, drag: false, px: 0, py: 0 };
  if (gAnim) cancelAnimationFrame(gAnim);
  drawGraph();
}
function drawGraph(){
  if (!g3d) return;
  const cv = $('#graphCanvas'), ctx = cv.getContext('2d');
  if (cv.width !== cv.clientWidth){ cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
  if (!g3d.drag) g3d.ay += 0.005;
  const cx = cv.width/2, cy = cv.height/2, S = Math.min(cx, cy) * 1.02, F = 3.2;
  const ca = Math.cos(g3d.ax), sa = Math.sin(g3d.ax), cb = Math.cos(g3d.ay), sb = Math.sin(g3d.ay);
  const proj = g3d.nodes.map(n => {
    const x1 = n.x * cb + n.z * sb, z1 = -n.x * sb + n.z * cb;
    const y2 = n.y * ca - z1 * sa, z2 = n.y * sa + z1 * ca;
    const sc = F / (F + z2 + 1.6);
    return { n, X: cx + x1 * S * sc, Y: cy + y2 * S * sc, Z: z2, sc };
  });
  const P = {}; proj.forEach(p => P[p.n.id] = p);
  ctx.clearRect(0,0,cv.width,cv.height);
  g3d.links.map(l => ({ a: P[l.a.id], b: P[l.b.id], w: l.w })).sort((u,v) => (v.a.Z + v.b.Z) - (u.a.Z + u.b.Z)).forEach(l => {
    const depth = Math.max(0.15, 1 - (l.a.Z + l.b.Z + 2) / 5);
    const alpha = Math.max(0.05, Math.min(0.9, Math.abs(l.w) * 2.4) * (0.25 + 0.75 * depth));
    ctx.strokeStyle = 'rgba(108,140,255,' + alpha.toFixed(3) + ')';
    ctx.lineWidth = Math.max(0.5, (0.6 + Math.abs(l.w) * 1.8) * ((l.a.sc + l.b.sc) / 2));
    ctx.beginPath(); ctx.moveTo(l.a.X, l.a.Y); ctx.lineTo(l.b.X, l.b.Y); ctx.stroke();
  });
  proj.sort((u,v) => v.Z - u.Z).forEach(p => {
    const r = (3.5 + Math.min(8, p.n.deg * 1.6 + p.n.act * 0.4)) * p.sc;
    ctx.fillStyle = p.Z < 0 ? '#8fb0ff' : '#4d68b8';
    ctx.beginPath(); ctx.arc(p.X, p.Y, r, 0, Math.PI * 2); ctx.fill();
    if (p.sc > 0.7){
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink'); ctx.globalAlpha = p.Z < 0 ? 1 : 0.55;
      ctx.font = Math.max(9, Math.round(12 * p.sc)) + 'px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.n.id, p.X, p.Y - r - 4); ctx.globalAlpha = 1;
    }
  });
  gAnim = requestAnimationFrame(drawGraph);
}
(function(){
  const cv = $('#graphCanvas');
  const start = (x,y) => { if (g3d){ g3d.drag = true; g3d.px = x; g3d.py = y; } };
  const move = (x,y) => { if (g3d && g3d.drag){ g3d.ay += (x - g3d.px) * 0.008; g3d.ax = Math.max(-1.4, Math.min(1.4, g3d.ax + (y - g3d.py) * 0.008)); g3d.px = x; g3d.py = y; } };
  cv.addEventListener('pointerdown', e => start(e.clientX, e.clientY));
  cv.addEventListener('pointermove', e => move(e.clientX, e.clientY));
  addEventListener('pointerup', () => { if (g3d) g3d.drag = false; });
  cv.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  cv.addEventListener('touchmove', e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  cv.addEventListener('touchend', () => { if (g3d) g3d.drag = false; });
})();

async function loadLog(){
  const rows = await (await fetch('/api/experience?limit=50')).json();
  $('#logTable').innerHTML = '<table><tr><th>#</th><th>時刻</th><th>種別</th><th>内容</th><th>報酬</th></tr>' +
    rows.map(r => '<tr><td>'+r.id+'</td><td>'+new Date(r.t*1000).toLocaleTimeString('ja-JP')+'</td><td>'+r.action+'</td><td>'+String(r.result).slice(0,60)+'</td><td>'+r.reward+'</td></tr>').join('') + '</table>';
}

let autoLearn = null;
async function loadSettings(){
  try {
    const s = await (await fetch('/api/settings')).json();
    autoLearn = s.auto_learn;
    $('#autoState').textContent = s.auto_learn ? 'ON' : 'OFF';
    $('#autoDetail').textContent = '実行回数: ' + s.auto_runs + (s.last_auto_at ? ' ／ 最終: ' + new Date(s.last_auto_at * 1000).toLocaleString('ja-JP') : '');
  } catch(e){}
}
async function toggleAuto(){
  const r = await fetch('/api/settings', { method:'POST', headers: adminHeaders(), body: JSON.stringify({ auto_learn: !autoLearn }) });
  if (r.ok) loadSettings(); else alert('変更できませんでした');
}
async function loadAdmin(){
  const m = await refreshMetrics();
  loadSettings();
  $('#statGrid').innerHTML = statCards(m);
  const q = await (await fetch('/api/guard')).json();
  $('#guardList').innerHTML = q.length ? q.map(g =>
    '<div class="rowflex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:7px 0"><span>#'+g.id+' '+g.detail+' <span class="muted">('+g.status+')</span></span>' +
    (g.status==='pending' ? '<span><button class="btn ok" onclick="decide('+g.id+',true)">承認</button> <button class="btn ng" onclick="decide('+g.id+',false)">却下</button></span>' : '') + '</div>').join('')
    : '<p class="muted">なし</p>';
  const snaps = await (await fetch('/api/snapshots')).json();
  $('#snapList').innerHTML = snaps.length ? snaps.map(s =>
    '<div class="rowflex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>'+s+'</span><button class="btn" onclick="restoreSnap(&quot;'+s+'&quot;)">この状態に戻す</button></div>').join('')
    : '<p class="muted">なし</p>';
}
async function decide(id, ok){
  await fetch('/api/guard/'+id+'/decide?approve='+ok, {method:'POST', headers: adminHeaders()});
  loadAdmin();
}
async function takeSnapshot(){
  const name = $('#snapName').value.trim() || ('snap-' + Date.now());
  await fetch('/api/snapshot',{method:'POST',headers:adminHeaders(),body:JSON.stringify({name})});
  loadAdmin();
}
async function restoreSnap(name){
  if(!confirm(name + ' の状態に戻しますか？')) return;
  await fetch('/api/snapshot/'+encodeURIComponent(name)+'/restore',{method:'POST',headers:adminHeaders()});
  loadAdmin(); refreshMetrics();
}
async function consolidate(){
  const r = await fetch('/api/consolidate',{method:'POST',headers:adminHeaders()});
  const j = await r.json();
  alert('剪定した接続: ' + j.pruned_edges + ' ／ 保存先: ' + j.snapshot);
  loadAdmin();
}
loadHome();
refreshMetrics();
</script>
</body>
</html>
`;

// Synaptic AI — Cloudflare Workers 版
// 体を持たないシナプス型自律AIの「連絡手段＋管理画面」Webアプリ。
//
// ストレージはアダプタ層の後ろに隠してある。後から外部ストレージ
// （R2 / KV / 独自APIなど）に差し替える場合は、同じメソッドを持つ
// クラスを1つ追加して createStore() の分岐に足すだけでよい。


/* ================= ストレージアダプタ =================
   インターフェース（全実装が同じメソッドを持つこと）:
     loadBrain():          Promise<object|null>  全状態の読み込み
     saveBrain(brain):     Promise<void>         全状態の保存
     saveSnapshot(n, edges): Promise<void>
     loadSnapshot(n):      Promise<object|null>  edges を返す
     listSnapshots():      Promise<string[]>
====================================================== */
class D1Store {
  constructor(db) { this.db = db; }
  async _ensure() {
    await this.db.prepare(
      "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    ).run();
  }
  async _get(key) {
    await this._ensure();
    const row = await this.db.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    return row ? JSON.parse(row.value) : null;
  }
  async _set(key, value) {
    await this._ensure();
    await this.db.prepare(
      "INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(key, JSON.stringify(value)).run();
  }
  async loadBrain() { return this._get("brain"); }
  async saveBrain(brain) { return this._set("brain", brain); }
  async saveSnapshot(name, edges) { return this._set("snap:" + name, edges); }
  async loadSnapshot(name) { return this._get("snap:" + name); }
  async listSnapshots() {
    await this._ensure();
    const res = await this.db.prepare("SELECT key FROM kv_store WHERE key LIKE 'snap:%'").all();
    return (res.results || []).map((r) => r.key.slice(5)).sort();
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

function activate(edges, seeds, depth = 2, threshold = 0.05) {
  const act = { ...seeds };
  let frontier = { ...seeds };
  for (let d = 0; d < depth; d++) {
    const nxt = {};
    for (const [node, a] of Object.entries(frontier)) {
      for (const [nb, e] of Object.entries(edges[node] || {})) {
        nxt[nb] = (nxt[nb] || 0) + a * e.w;
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
function tokenize(text) {
  const cleaned = text.replace(/[、。！？!?・「」『』（）()\[\]\s]+/g, " ");
  const parts = cleaned.split(/は|が|を|に|へ|と|の|で|や|も|から|まで|より|けど|ので|のに/);
  const tokens = [];
  for (let p of parts) {
    p = p.trim();
    if (p && !STOP.has(p) && p.length <= 20 && !tokens.includes(p)) tokens.push(p);
  }
  return tokens.slice(0, 12);
}

const IRREVERSIBLE = ["送信して", "送って", "削除して", "消して", "公開して", "買って", "支払って", "投稿して"];

/* ================= 本体 ================= */
const defaultBrain = () => ({ edges: {}, log: [], guard: [], guardSeq: 0, expSeq: 0, auto: { enabled: true, lastAt: 0, lastSeq: 0, runs: 0 } });

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

const __worker = {
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

    // --- チャット（連絡手段） ---
    if (path === "/api/chat" && request.method === "POST") {
      const { message } = await request.json();
      const text = (message || "").trim();
      if (!text) return json({ detail: "message is empty" }, 400);

      if (IRREVERSIBLE.some((w) => text.includes(w))) {
        brain.guardSeq += 1;
        const item = { id: brain.guardSeq, action: "irreversible_request", detail: text, status: "pending", t: Date.now() / 1000 };
        brain.guard.push(item);
        addLog(brain, [text], "guard_blocked", `承認キュー #${item.id} に回送`, 0);
        await store.saveBrain(brain);
        return json({
          reply: `その操作は取り返しがつかない種類なので、自分では実行しません。管理画面の承認キュー（#${item.id}）に回しました。承認されれば実行されます。`,
          activated: {}, guard_id: item.id,
        });
      }

      const tokens = tokenize(text);
      const seeds = Object.fromEntries(tokens.map((t) => [t, 1.0]));
      const activated = tokens.length ? activate(brain.edges, seeds) : {};
      const recalled = Object.entries(activated).filter(([n]) => !(n in seeds)).sort((a, b) => b[1] - a[1]);
      if (tokens.length) learn(brain.edges, seeds, 0.6);
      const rec = addLog(brain, tokens, "chat", text, 0.6);
      if (brain.auto.enabled && brain.expSeq - brain.auto.lastSeq >= 30) await consolidateBrain(store, brain, true);
      await store.saveBrain(brain);

      let reply;
      if (recalled.length) reply = `「${recalled.slice(0, 5).map(([n]) => n).join("、")}」を思い出しました。`;
      else if (tokens.length) reply = "覚えました。";
      else reply = "うまく切り分けられませんでした。";
      return json({ reply, activated, experience_id: rec.id });
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
    if (path === "/api/memory/graph") return json(graph(brain.edges));
    if (path === "/api/experience") {
      const limit = Number(url.searchParams.get("limit") || 50);
      return json(brain.log.slice(-limit).reverse());
    }
    if (path === "/api/metrics") {
      return json({ ...stats(brain.edges), experience_count: brain.expSeq, guard_pending: brain.guard.filter((g) => g.status === "pending").length, auto_learn: brain.auto.enabled, auto_runs: brain.auto.runs, last_auto_at: brain.auto.lastAt });
    }
    if (path === "/api/consolidate" && request.method === "POST") {
      const ng = requireAdmin(request, env); if (ng) return ng;
      const { pruned, snapshot } = await consolidateBrain(store, brain, false);
      await store.saveBrain(brain);
      return json({ ok: true, pruned_edges: pruned, snapshot, stats: stats(brain.edges) });
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
    if (!brain.auto.enabled) return;
    await consolidateBrain(store, brain, true);
    await store.saveBrain(brain);
  },
};

export default __worker;
