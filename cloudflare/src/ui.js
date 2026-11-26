// WebアプリのUI（管理画面＋連絡チャット）。public/index.html と同じ内容。
export const HTML = `<!DOCTYPE html>
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
      <h2>記憶グラフ</h2>
      <canvas id="graphCanvas" width="800" height="420"></canvas>
      <div style="margin-top:10px"><button class="btn" onclick="loadGraph()">再読み込み</button></div>
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
  <button data-tab="home" class="on"><span class="ic">⌂</span>ホーム</button>
  <button data-tab="chat"><span class="ic">❝</span>チャット</button>
  <button data-tab="graph"><span class="ic">◉</span>記憶</button>
  <button data-tab="log"><span class="ic">≡</span>ログ</button>
  <button data-tab="admin"><span class="ic">⚙</span>管理</button>
</nav>

<script>
const $ = s => document.querySelector(s);
const token = () => localStorage.getItem('admin_token') || '';
$('#adminToken').value = token();
$('#adminToken').addEventListener('change', e => localStorage.setItem('admin_token', e.target.value));
const adminHeaders = () => ({'Content-Type':'application/json','X-Admin-Token': token()});

function switchTab(name){
  document.querySelectorAll('#tabbar button').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id === 'tab-' + name));
  $('#composer').style.display = name === 'chat' ? 'block' : 'none';
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

async function loadGraph(){
  const g = await (await fetch('/api/memory/graph')).json();
  const cv = $('#graphCanvas'), ctx = cv.getContext('2d');
  cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  const W = cv.width, H = cv.height;
  const pos = {};
  g.nodes.forEach((n,i)=>{ const a = i / Math.max(1,g.nodes.length) * Math.PI*2;
    pos[n.id] = {x: W/2 + Math.cos(a)*(W*0.36), y: H/2 + Math.sin(a)*(H*0.36)}; });
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = '#9ca3af';
  g.links.forEach(l => { const a=pos[l.source], b=pos[l.target]; if(!a||!b) return;
    ctx.lineWidth = Math.max(0.5, Math.abs(l.w)*4); ctx.globalAlpha = 0.25 + Math.abs(l.w)*0.6;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); });
  ctx.globalAlpha = 1; ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink');
  ctx.font = '12px sans-serif'; ctx.textAlign='center';
  g.nodes.forEach(n => { const p = pos[n.id];
    ctx.beginPath(); ctx.arc(p.x,p.y,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillText(n.id, p.x, p.y - 8); });
  if(!g.nodes.length) { ctx.font='14px sans-serif'; ctx.fillText('まだ記憶がありません', W/2, H/2); }
}

async function loadLog(){
  const rows = await (await fetch('/api/experience?limit=50')).json();
  $('#logTable').innerHTML = '<table><tr><th>#</th><th>時刻</th><th>種別</th><th>内容</th><th>報酬</th></tr>' +
    rows.map(r => '<tr><td>'+r.id+'</td><td>'+new Date(r.t*1000).toLocaleTimeString('ja-JP')+'</td><td>'+r.action+'</td><td>'+String(r.result).slice(0,60)+'</td><td>'+r.reward+'</td></tr>').join('') + '</table>';
}

async function loadAdmin(){
  const m = await refreshMetrics();
  $('#statGrid').innerHTML = statCards(m);
  const q = await (await fetch('/api/guard')).json();
  $('#guardList').innerHTML = q.length ? q.map(g =>
    '<div class="rowflex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:7px 0"><span>#'+g.id+' '+g.detail+' <span class="muted">('+g.status+')</span></span>' +
    (g.status==='pending' ? '<span><button class="btn ok" onclick="decide('+g.id+',true)">承認</button> <button class="btn ng" onclick="decide('+g.id+',false)">却下</button></span>' : '') + '</div>').join('')
    : '<p class="muted">なし</p>';
  const snaps = await (await fetch('/api/snapshots')).json();
  $('#snapList').innerHTML = snaps.length ? snaps.map(s =>
    '<div class="rowflex" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>'+s+'</span><button class="btn" onclick="restoreSnap(\''+s+'\')">この状態に戻す</button></div>').join('')
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
