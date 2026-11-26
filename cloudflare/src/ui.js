// Web app UI (admin console + chat). Same content as app/static/index.html.
export const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Synaptic AI</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0b0e14">
<style>
  :root{ --bg:#f4f5f7; --card:#ffffff; --ink:#14181f; --muted:#6b7280; --line:#e2e4ea; --accent:#2f5cff; --bubble:#eef1f6; --nav-h:62px; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0b0e14; --card:#151a24; --ink:#e8eaf2; --muted:#8b93a7; --line:#232a38; --accent:#6c8cff; --bubble:#1b2231; } }
  *{ box-sizing:border-box; }
  html,body{ margin:0; padding:0; }
  body{ font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--ink); }
  header{ position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:var(--bg); border-bottom:1px solid var(--line); }
  header h1{ font-size:19px; margin:0; letter-spacing:.2px; }
  header .hstats{ font-size:12px; color:var(--muted); text-align:right; line-height:1.5; }
  main{ padding:14px 14px calc(var(--nav-h) + env(safe-area-inset-bottom) + 96px); max-width:860px; margin:0 auto; }
  section{ display:none; }
  section.on{ display:block; }
  .card{ background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; margin-bottom:14px; }
  .card h2{ font-size:15px; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
  .grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .stat{ background:var(--bubble); border-radius:12px; padding:12px; }
  .stat .v{ font-size:22px; font-weight:700; }
  .stat .k{ font-size:12px; color:var(--muted); margin-top:2px; }
  .muted{ color:var(--muted); font-size:13px; }
  .rowflex{ display:flex; gap:8px; align-items:center; }
  input[type=text],input[type=password]{ flex:1; padding:11px 12px; border:1px solid var(--line); border-radius:10px; background:var(--card); color:var(--ink); font-size:15px; }
  button.btn{ padding:10px 14px; border:1px solid var(--line); border-radius:10px; background:var(--card); color:var(--ink); font-size:14px; cursor:pointer; }
  button.primary{ background:var(--ink); color:var(--bg); border-color:var(--ink); font-weight:600; }
  table{ width:100%; border-collapse:collapse; font-size:12.5px; }
  th,td{ text-align:left; padding:6px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  canvas{ width:100%; height:52vh; min-height:320px; display:block; border-radius:12px; background:radial-gradient(ellipse at 50% 42%, rgba(108,140,255,.10), rgba(0,0,0,0) 70%); touch-action:none; }
  #composer{ position:fixed; left:0; right:0; bottom:calc(var(--nav-h) + env(safe-area-inset-bottom)); z-index:6; background:var(--bg); border-top:1px solid var(--line); padding:10px 12px; display:none; }
  #composer .inner{ max-width:860px; margin:0 auto; display:flex; gap:8px; }
  #chatLog{ display:flex; flex-direction:column; gap:10px; }
  .msg{ max-width:82%; padding:10px 13px; border-radius:16px; font-size:15px; line-height:1.45; white-space:pre-wrap; word-break:break-word; }
  .msg.me{ align-self:flex-end; background:var(--accent); color:#fff; border-bottom-right-radius:4px; }
  .msg.ai{ align-self:flex-start; background:var(--bubble); border-bottom-left-radius:4px; }
  .fbrow{ align-self:flex-start; display:flex; gap:6px; margin-top:-4px; }
  .fbrow button{ border:1px solid var(--line); background:var(--card); border-radius:999px; padding:3px 10px; font-size:13px; cursor:pointer; color:var(--muted); }
  #tabbar{ position:fixed; left:0; right:0; bottom:0; z-index:7; height:calc(var(--nav-h) + env(safe-area-inset-bottom)); padding-bottom:env(safe-area-inset-bottom); background:var(--card); border-top:1px solid var(--line); display:flex; }
  #tabbar button{ flex:1; border:0; background:none; color:var(--muted); font-size:11px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; cursor:pointer; padding:6px 0; -webkit-tap-highlight-color:transparent; }
  #tabbar button .ic{ font-size:19px; line-height:1; }
  #tabbar button.on{ color:var(--ink); font-weight:700; }
  .livedot{ width:8px; height:8px; border-radius:50%; background:#34c759; display:inline-block; animation:pulse 1.6s infinite; }
  @keyframes pulse{ 0%{ opacity:1; } 50%{ opacity:.25; } 100%{ opacity:1; } }
  .snaprow{ display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding:7px 0; }
</style>
</head>
<body>
<header>
  <h1>Synaptic AI</h1>
  <div class="hstats" id="hstats">Nodes - / Edges -<br>Experiences - / Pending -</div>
</header>
<main>
  <section id="tab-home" class="on">
    <div class="card">
      <h2>Status</h2>
      <div class="grid" id="homeStats"></div>
    </div>
    <div class="card">
      <h2>Recent Experiences</h2>
      <div id="homeRecent" class="muted">-</div>
    </div>
  </section>

  <section id="tab-chat">
    <div id="chatLog"></div>
  </section>

  <section id="tab-graph">
    <div class="card">
      <h2>Synapse Structure <span class="livedot" title="Live"></span><span class="muted" style="font-weight:400">Live</span></h2>
      <canvas id="graphCanvas" width="800" height="520"></canvas>
      <div class="rowflex" style="margin-top:10px;justify-content:space-between">
        <span class="muted">Drag to rotate</span>
        <button class="btn" onclick="loadGraph()">Reload</button>
      </div>
    </div>
  </section>

  <section id="tab-log">
    <div class="card">
      <h2>Experience Log</h2>
      <div id="logTable" style="overflow-x:auto"></div>
      <div style="margin-top:10px"><button class="btn" onclick="loadLog()">Reload</button></div>
    </div>
  </section>

  <section id="tab-admin">
    <div class="card">
      <h2>Status</h2>
      <div class="grid" id="statGrid"></div>
    </div>
    <div class="card">
      <h2>Auto Learning</h2>
      <div class="rowflex" style="justify-content:space-between">
        <span id="autoState">...</span>
        <button class="btn" onclick="toggleAuto()">Toggle</button>
      </div>
      <div id="autoDetail" class="muted" style="margin-top:6px"></div>
    </div>
    <div class="card">
      <h2>Approval Queue</h2>
      <div id="guardList"></div>
    </div>
    <div class="card">
      <h2>Snapshots / Sleep</h2>
      <div class="rowflex">
        <input type="text" id="snapName" placeholder="Snapshot name">
        <button class="btn primary" onclick="takeSnapshot()">Save</button>
      </div>
      <div class="rowflex" style="margin-top:10px">
        <button class="btn" onclick="consolidate()">Sleep (replay + decay + snapshot)</button>
      </div>
      <div id="snapList" style="margin-top:10px"></div>
    </div>
    <div class="card">
      <h2>Admin Token</h2>
      <input type="password" id="adminToken" placeholder="X-Admin-Token (if set)">
    </div>
  </section>
</main>

<div id="composer">
  <div class="inner">
    <input type="text" id="chatInput" placeholder="Type a message" autocomplete="off">
    <button class="btn primary" onclick="sendMsg()">Send</button>
  </div>
</div>

<nav id="tabbar">
  <button data-tab="home" class="on" onclick="switchTab('home')"><span class="ic">⌂</span>Home</button>
  <button data-tab="chat" onclick="switchTab('chat')"><span class="ic">❝</span>Chat</button>
  <button data-tab="graph" onclick="switchTab('graph')"><span class="ic">◉</span>Memory</button>
  <button data-tab="log" onclick="switchTab('log')"><span class="ic">≡</span>Log</button>
  <button data-tab="admin" onclick="switchTab('admin')"><span class="ic">⚙</span>Admin</button>
</nav>

<script>
var $ = function(s){ return document.querySelector(s); };
var store = {
  get: function(k){ try { return localStorage.getItem(k) || ""; } catch(e){ return ""; } },
  set: function(k,v){ try { localStorage.setItem(k, v); } catch(e){} }
};
function token(){ return store.get("admin_token"); }
try {
  $("#adminToken").value = token();
  $("#adminToken").addEventListener("change", function(e){ store.set("admin_token", e.target.value); });
} catch(e){}
function adminHeaders(){
  var h = { "Content-Type": "application/json" };
  var t = token(); if (t) h["X-Admin-Token"] = t;
  return h;
}
var curTab = "home";
var liveTimer = null;
function switchTab(name){
  curTab = name;
  document.querySelectorAll("main section").forEach(function(s){ s.classList.toggle("on", s.id === "tab-" + name); });
  document.querySelectorAll("#tabbar button").forEach(function(b){ b.classList.toggle("on", b.dataset.tab === name); });
  $("#composer").style.display = name === "chat" ? "block" : "none";
  if (name !== "graph" && gAnim) { cancelAnimationFrame(gAnim); gAnim = null; }
  if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  if (name === "home") { loadHome(); liveTimer = setInterval(function(){ if (!document.hidden && curTab === "home") loadHome(); }, 6000); }
  if (name === "chat") { var ci = $("#chatInput"); if (ci) ci.focus(); }
  if (name === "graph") { loadGraph(); liveTimer = setInterval(function(){ if (!document.hidden && curTab === "graph") mergeGraph(); }, 4000); }
  if (name === "log") loadLog();
  if (name === "admin") loadAdmin();
}
document.querySelectorAll("#tabbar button").forEach(function(b){ b.addEventListener("click", function(){ switchTab(b.dataset.tab); }); });

function statCards(m){
  return "<div class='stat'><div class='v'>" + m.nodes + "</div><div class='k'>Nodes</div></div>"
    + "<div class='stat'><div class='v'>" + m.edges + "</div><div class='k'>Edges</div></div>"
    + "<div class='stat'><div class='v'>" + m.avg_weight + "</div><div class='k'>Avg strength</div></div>"
    + "<div class='stat'><div class='v'>" + m.experience_count + "</div><div class='k'>Experiences</div></div>"
    + "<div class='stat'><div class='v'>" + m.guard_pending + "</div><div class='k'>Pending approvals</div></div>";
}
async function refreshMetrics(){
  try {
    var m = await (await fetch("/api/metrics")).json();
    $("#hstats").innerHTML = "Nodes " + m.nodes + " / Edges " + m.edges + "<br>Experiences " + m.experience_count + " / Pending " + m.guard_pending;
    return m;
  } catch(e){ return null; }
}
async function loadHome(){
  var m = await refreshMetrics();
  if (m) $("#homeStats").innerHTML = statCards(m);
  try {
    var rows = await (await fetch("/api/experience?limit=5")).json();
    $("#homeRecent").innerHTML = rows.length
      ? rows.map(function(r){ return "<div style='padding:5px 0;border-bottom:1px solid var(--line)'><span class='muted'>" + new Date(r.t * 1000).toLocaleTimeString("en-US") + " / " + r.action + "</span><br>" + String(r.result).slice(0, 80) + "</div>"; }).join("")
      : "None";
  } catch(e){}
}

function addMsg(text, who, expId){
  var log = $("#chatLog");
  var d = document.createElement("div");
  d.className = "msg " + who; d.textContent = text;
  log.appendChild(d);
  if (who === "ai" && expId) {
    var row = document.createElement("div"); row.className = "fbrow";
    [1, -1].forEach(function(v){
      var b = document.createElement("button");
      b.textContent = v > 0 ? "👍" : "👎";
      b.onclick = async function(){
        await fetch("/api/feedback", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ experience_id: expId, value: v }) });
        b.textContent = v > 0 ? "👍 ✓" : "👎 ✓";
        refreshMetrics();
      };
      row.appendChild(b);
    });
    log.appendChild(row);
  }
  window.scrollTo(0, document.body.scrollHeight);
}
async function sendMsg(){
  var inp = $("#chatInput"), text = inp.value.trim();
  if (!text) return;
  inp.value = "";
  addMsg(text, "me");
  try {
    var r = await fetch("/api/chat", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ message: text }) });
    var j = await r.json();
    addMsg(j.reply || ("Error: " + (j.detail || r.status)), "ai", j.experience_id);
  } catch(e){ addMsg("Connection error", "ai"); }
  refreshMetrics();
}
$("#chatInput").addEventListener("keydown", function(e){ if (e.key === "Enter") sendMsg(); });

async function loadLog(){
  var rows = await (await fetch("/api/experience?limit=50")).json();
  $("#logTable").innerHTML = "<table><tr><th>#</th><th>Time</th><th>Type</th><th>Content</th><th>Reward</th></tr>"
    + rows.map(function(r){ return "<tr><td>" + r.id + "</td><td>" + new Date(r.t * 1000).toLocaleTimeString("en-US") + "</td><td>" + r.action + "</td><td>" + String(r.result).slice(0, 60) + "</td><td>" + r.reward + "</td></tr>"; }).join("") + "</table>";
}
</script>

<script>
// ---- Synapse structure (3D, high-DPI, live) ----
var g3d = null, gAnim = null;
var DPR = Math.min(window.devicePixelRatio || 1, 3);
function hash3(s){ var h = 2166136261; for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
function nodePos(id){
  var t = hash3(id) * Math.PI * 2, ph = Math.acos(2 * hash3(id + "#") - 1);
  return { x: Math.sin(ph) * Math.cos(t), y: Math.cos(ph), z: Math.sin(ph) * Math.sin(t) };
}
function makeSprite(stops){
  var s = document.createElement("canvas"); s.width = s.height = 128;
  var x = s.getContext("2d");
  var g = x.createRadialGradient(46, 40, 4, 64, 64, 62);
  stops.forEach(function(st){ g.addColorStop(st[0], st[1]); });
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  return s;
}
var SPR_FRONT = makeSprite([[0, "#ffffff"], [0.25, "#b9d2ff"], [0.62, "#6c8cff"], [1, "#2c4cc0"]]);
var SPR_BACK = makeSprite([[0, "#8fa5d8"], [0.3, "#54679f"], [0.7, "#31477e"], [1, "#1d2c52"]]);
function buildNodes(g){
  var deg = {};
  g.links.forEach(function(l){ deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; });
  return g.nodes.map(function(n){
    var p = nodePos(n.id);
    return { id: n.id, act: n.activation || 0, deg: deg[n.id] || 0, x: p.x, y: p.y, z: p.z };
  });
}
function linkRefs(nodes, links){
  var idx = {}; nodes.forEach(function(n){ idx[n.id] = n; });
  return links.filter(function(l){ return idx[l.source] && idx[l.target]; })
    .map(function(l){ return { a: idx[l.source], b: idx[l.target], w: typeof l.w === "number" ? l.w : 0.3 }; });
}
async function loadGraph(){
  var g = await (await fetch("/api/memory/graph")).json();
  var cv = $("#graphCanvas");
  if (!g.nodes.length){
    var f = fitCanvas(cv); f.ctx.clearRect(0, 0, f.W, f.H);
    f.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
    f.ctx.font = "14px sans-serif"; f.ctx.textAlign = "center";
    f.ctx.fillText("No memories yet", f.W / 2, f.H / 2);
    g3d = null; return;
  }
  var nodes = buildNodes(g);
  g3d = { nodes: nodes, links: linkRefs(nodes, g.links), ax: 0.5, ay: 0, drag: false, px: 0, py: 0 };
  if (gAnim) cancelAnimationFrame(gAnim);
  drawGraph();
}
async function mergeGraph(){
  try {
    var g = await (await fetch("/api/memory/graph")).json();
    refreshMetrics();
    if (!g.nodes.length || !g3d) { if (g.nodes.length) loadGraph(); return; }
    var deg = {};
    g.links.forEach(function(l){ deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; });
    var keep = {};
    g.nodes.forEach(function(n){ keep[n.id] = true; });
    g3d.nodes = g3d.nodes.filter(function(n){ return keep[n.id]; });
    var have = {}; g3d.nodes.forEach(function(n){ have[n.id] = n; });
    g.nodes.forEach(function(n){
      if (have[n.id]) { have[n.id].deg = deg[n.id] || 0; have[n.id].act = n.activation || 0; }
      else { var p = nodePos(n.id); g3d.nodes.push({ id: n.id, act: n.activation || 0, deg: deg[n.id] || 0, x: p.x, y: p.y, z: p.z }); }
    });
    g3d.links = linkRefs(g3d.nodes, g.links);
  } catch(e){}
}
function fitCanvas(cv){
  var W = cv.clientWidth, H = cv.clientHeight;
  var tw = Math.round(W * DPR), th = Math.round(H * DPR);
  if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
  var ctx = cv.getContext("2d");
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  return { ctx: ctx, W: W, H: H };
}
function drawGraph(){
  if (!g3d) return;
  var cv = $("#graphCanvas");
  var f = fitCanvas(cv), ctx = f.ctx;
  if (!g3d.drag) g3d.ay += 0.0042;
  var cx = f.W / 2, cy = f.H / 2, S = Math.min(cx, cy) * 1.04, F = 3.2;
  var ca = Math.cos(g3d.ax), sa = Math.sin(g3d.ax), cb = Math.cos(g3d.ay), sb = Math.sin(g3d.ay);
  var proj = g3d.nodes.map(function(n){
    var x1 = n.x * cb + n.z * sb, z1 = -n.x * sb + n.z * cb;
    var y2 = n.y * ca - z1 * sa, z2 = n.y * sa + z1 * ca;
    var sc = F / (F + z2 + 1.6);
    return { n: n, X: cx + x1 * S * sc, Y: cy + y2 * S * sc, Z: z2, sc: sc };
  });
  var P = {}; proj.forEach(function(p){ P[p.n.id] = p; });
  ctx.clearRect(0, 0, f.W, f.H);
  var links = g3d.links.map(function(l){ return { a: P[l.a.id], b: P[l.b.id], w: l.w }; })
    .sort(function(u, v){ return (v.a.Z + v.b.Z) - (u.a.Z + u.b.Z); });
  ctx.lineCap = "round";
  links.forEach(function(l){
    var depth = Math.max(0.12, 1 - (l.a.Z + l.b.Z + 2) / 5);
    var alpha = Math.max(0.04, Math.min(0.85, Math.abs(l.w) * 2.6) * (0.2 + 0.8 * depth));
    ctx.strokeStyle = "rgba(108,140,255," + alpha.toFixed(3) + ")";
    ctx.lineWidth = Math.max(0.6, (0.7 + Math.abs(l.w) * 2.2) * ((l.a.sc + l.b.sc) / 2));
    ctx.beginPath(); ctx.moveTo(l.a.X, l.a.Y); ctx.lineTo(l.b.X, l.b.Y); ctx.stroke();
  });
  proj.sort(function(u, v){ return v.Z - u.Z; }).forEach(function(p){
    var r = (4 + Math.min(9, p.n.deg * 1.7 + p.n.act * 0.4)) * p.sc;
    ctx.globalAlpha = Math.max(0.35, Math.min(1, 1.15 - (p.Z + 1) * 0.32));
    var spr = p.Z < 0 ? SPR_FRONT : SPR_BACK;
    ctx.drawImage(spr, p.X - r, p.Y - r, r * 2, r * 2);
  });
  ctx.globalAlpha = 1;
  var ink = getComputedStyle(document.body).getPropertyValue("--ink");
  var bgc = getComputedStyle(document.body).getPropertyValue("--bg");
  var labeled = proj.filter(function(p){ return p.sc > 0.74 && p.n.deg >= 2; })
    .sort(function(u, v){ return v.n.deg - u.n.deg; }).slice(0, 42);
  ctx.textAlign = "center";
  labeled.forEach(function(p){
    var r = (4 + Math.min(9, p.n.deg * 1.7 + p.n.act * 0.4)) * p.sc;
    ctx.font = "600 " + Math.max(9, Math.round(11.5 * p.sc)) + "px sans-serif";
    ctx.shadowColor = bgc; ctx.shadowBlur = 4;
    ctx.globalAlpha = p.Z < 0 ? 0.95 : 0.55;
    ctx.fillStyle = ink;
    ctx.fillText(p.n.id, p.X, p.Y - r - 4);
  });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  gAnim = requestAnimationFrame(drawGraph);
}
(function(){
  var cv = $("#graphCanvas");
  var start = function(x, y){ if (g3d){ g3d.drag = true; g3d.px = x; g3d.py = y; } };
  var move = function(x, y){ if (g3d && g3d.drag){ g3d.ay += (x - g3d.px) * 0.008; g3d.ax = Math.max(-1.4, Math.min(1.4, g3d.ax + (y - g3d.py) * 0.008)); g3d.px = x; g3d.py = y; } };
  cv.addEventListener("pointerdown", function(e){ start(e.clientX, e.clientY); });
  cv.addEventListener("pointermove", function(e){ move(e.clientX, e.clientY); });
  addEventListener("pointerup", function(){ if (g3d) g3d.drag = false; });
  cv.addEventListener("touchstart", function(e){ start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  cv.addEventListener("touchmove", function(e){ move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  cv.addEventListener("touchend", function(){ if (g3d) g3d.drag = false; });
})();

// ---- Admin ----
var autoLearn = null;
async function loadSettings(){
  try {
    var s = await (await fetch("/api/settings")).json();
    autoLearn = s.auto_learn;
    $("#autoState").textContent = s.auto_learn ? "ON" : "OFF";
    $("#autoDetail").textContent = "Runs: " + s.auto_runs + (s.last_auto_at ? " / Last: " + new Date(s.last_auto_at * 1000).toLocaleString("en-US") : "");
  } catch(e){}
}
async function toggleAuto(){
  var r = await fetch("/api/settings", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ auto_learn: !autoLearn }) });
  if (r.ok) loadSettings(); else alert("Could not update");
}
async function loadAdmin(){
  var m = await refreshMetrics();
  if (m) $("#statGrid").innerHTML = statCards(m);
  loadSettings();
  var guard = await (await fetch("/api/guard")).json();
  $("#guardList").innerHTML = guard.length ? guard.map(function(g){
    var btns = g.status === "pending"
      ? "<span><button class='btn' onclick='decide(" + g.id + ",true)'>Approve</button> <button class='btn' onclick='decide(" + g.id + ",false)'>Reject</button></span>" : "<span class='muted'>" + g.status + "</span>";
    return "<div class='snaprow'><span>#" + g.id + " " + g.detail + "</span>" + btns + "</div>";
  }).join("") : "<span class='muted'>None</span>";
  var snaps = await (await fetch("/api/snapshots")).json();
  $("#snapList").innerHTML = snaps.length ? snaps.map(function(s){
    return "<div class='snaprow'><span>" + s + "</span><button class='btn' data-n='" + s + "' onclick='restoreSnap(this.dataset.n)'>Restore</button></div>";
  }).join("") : "<span class='muted'>None</span>";
}
async function decide(id, ok){
  await fetch("/api/guard/" + id + "/decide?approve=" + ok, { method: "POST", headers: adminHeaders() });
  loadAdmin();
}
async function takeSnapshot(){
  var name = $("#snapName").value.trim() || ("snap-" + Date.now());
  await fetch("/api/snapshot", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ name: name }) });
  loadAdmin();
}
async function restoreSnap(name){
  if (!confirm("Restore to " + name + "?")) return;
  await fetch("/api/snapshot/" + encodeURIComponent(name) + "/restore", { method: "POST", headers: adminHeaders() });
  loadAdmin(); refreshMetrics();
}
async function consolidate(){
  var r = await fetch("/api/consolidate", { method: "POST", headers: adminHeaders() });
  var j = await r.json();
  alert("Pruned edges: " + j.pruned_edges + " / Snapshot: " + j.snapshot);
  loadAdmin();
}
loadHome();
refreshMetrics();
</script>
</body>
</html>
`;
