"""体を持たないシナプス型自律AI — バックエンド

- 連絡手段: チャットAPI（Webアプリから使う）
- 管理画面: 記憶グラフ / 経験ログ / 評価指標 / スナップショット / 承認キュー
- 安全ガード: 不可逆操作（送信・削除・公開・決済）は学習層では実行せず、
  承認キューに回す。実行権は人間の承認が持つ。
"""
import os
import re
import time
import json
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, WebSocket
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from synapse_core import SynapticMemory, ExperienceLog

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "data"
SNAP_DIR = DATA / "snapshots"
SNAP_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE = DATA / "state.json"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")  # 設定時のみ管理操作に必須

mem = SynapticMemory()
if STATE_FILE.exists():
    mem.load(STATE_FILE)
log = ExperienceLog(str(DATA / "experience.jsonl"))

guard_queue = []  # {id, action, detail, status, t}
guard_seq = 0

app = FastAPI(title="Synaptic AI")


def persist():
    mem.save(STATE_FILE)


def require_admin(x_admin_token: str = ""):
    if ADMIN_TOKEN and x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="管理者トークンが必要です")


# ---------------- 分かち書き（簡易） ----------------
PARTICLES = "は|が|を|に|へ|と|の|で|や|も|から|まで|より|けど|ので|のに"
STOP = {"です", "ます", "した", "する", "ある", "いる", "なる", "こと", "もの", "これ", "それ", "あれ", "私", "僕"}


def tokenize(text: str):
    text = re.sub(r"[、。！？!?・「」『』（）()\[\]\s]+", " ", text)
    parts = re.split(PARTICLES, text)
    tokens = []
    for p in parts:
        p = p.strip()
        if p and p not in STOP and len(p) <= 20 and p not in tokens:
            tokens.append(p)
    return tokens[:12]


IRREVERSIBLE = ["送信して", "送って", "削除して", "消して", "公開して", "買って", "支払って", "投稿して"]


# ---------------- チャット（連絡手段） ----------------
class ChatIn(BaseModel):
    message: str


@app.post("/api/chat")
def chat(body: ChatIn):
    global guard_seq
    text = body.message.strip()
    if not text:
        raise HTTPException(400, "message is empty")

    # 安全ガード: 不可逆操作は実行せず承認キューへ
    hit = [w for w in IRREVERSIBLE if w in text]
    if hit:
        guard_seq += 1
        item = {
            "id": guard_seq,
            "action": "irreversible_request",
            "detail": text,
            "status": "pending",
            "t": time.time(),
        }
        guard_queue.append(item)
        log.add([text], "guard_blocked", f"承認キュー #{guard_seq} に回送", 0.0)
        persist()
        return {
            "reply": f"その操作は取り返しがつかない種類なので、自分では実行しません。管理画面の承認キュー（#{guard_seq}）に回しました。承認されれば実行されます。",
            "activated": {},
            "guard_id": guard_seq,
        }

    tokens = tokenize(text)
    seeds = {t: 1.0 for t in tokens}
    activated = mem.activate(seeds) if tokens else {}
    recalled = sorted(
        ((n, a) for n, a in activated.items() if n not in seeds),
        key=lambda x: -x[1],
    )
    if tokens:
        mem.learn({t: 1.0 for t in tokens}, reward=0.6)
    rec = log.add(tokens, "chat", text, 0.6)
    persist()
    maybe_auto_consolidate()

    if recalled:
        names = "、".join(n for n, _ in recalled[:5])
        reply = f"「{names}」を思い出しました。"
    elif tokens:
        reply = "覚えました。"
    else:
        reply = "うまく切り分けられませんでした。"
    return {"reply": reply, "activated": activated, "experience_id": rec["id"]}


@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    while True:
        data = await ws.receive_text()
        result = chat(ChatIn(message=data))
        await ws.send_text(json.dumps(result, ensure_ascii=False))


# ---------------- フィードバック（報酬信号） ----------------
class FeedbackIn(BaseModel):
    experience_id: int
    value: float  # +1 = 良い, -1 = 悪い


@app.post("/api/feedback")
def feedback(body: FeedbackIn):
    rec = log.get(body.experience_id)
    if not rec:
        raise HTTPException(404, "experience not found")
    tokens = [t for t in rec["in"] if isinstance(t, str)]
    if tokens:
        mem.learn({t: 1.0 for t in tokens}, reward=body.value * 0.8)
        persist()
    log.add(tokens, "feedback", f"exp#{body.experience_id} -> {body.value}", body.value)
    return {"ok": True, "stats": mem.stats()}


# ---------------- 管理画面用API ----------------
@app.get("/api/memory/graph")
def graph():
    return mem.graph()


@app.get("/api/experience")
def experience(limit: int = 50):
    return log.recent(limit)


@app.get("/api/metrics")
def metrics():
    s = mem.stats()
    s["experience_count"] = len(log.recent(100000))
    s["guard_pending"] = sum(1 for g in guard_queue if g["status"] == "pending")
    st = load_settings()
    s["auto_learn"] = st["auto_enabled"]
    s["auto_runs"] = st["runs"]
    s["last_auto_at"] = st["last_at"]
    return s


# ---------------- 自動学習 ----------------
SETTINGS_PATH = DATA / "settings.json"
DEFAULT_SETTINGS = {"auto_enabled": True, "last_seq": 0, "last_at": 0.0, "runs": 0}


def load_settings() -> dict:
    if SETTINGS_PATH.exists():
        s = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        return {**DEFAULT_SETTINGS, **s}
    return dict(DEFAULT_SETTINGS)


def save_settings(s: dict) -> None:
    SETTINGS_PATH.write_text(json.dumps(s, ensure_ascii=False), encoding="utf-8")


def consolidate_memory(is_auto: bool) -> dict:
    """経験リプレイ（報酬が正のチャットを弱く再学習）→ 忘却・剪定 → 自動スナップショット。"""
    for rec in reversed(log.recent(200)):
        if rec["action"] != "chat" or not (rec["reward"] > 0):
            continue
        toks = [x for x in rec["in"] if isinstance(x, str)]
        if len(toks) > 1:
            mem.learn({x: 1.0 for x in toks}, reward=0.15 * rec["reward"])
    pruned = mem.decay_all()
    persist()
    name = time.strftime("auto-%Y%m%d-%H%M%S")
    mem.save(SNAP_DIR / f"{name}.json")
    s = load_settings()
    if is_auto:
        s["runs"] += 1
    s["last_at"] = time.time()
    s["last_seq"] = len(log.recent(1000000))
    save_settings(s)
    log.add([], "auto_consolidate" if is_auto else "consolidate", f"replay+decay pruned={pruned}", 0)
    return {"pruned_edges": pruned, "snapshot": name}


def maybe_auto_consolidate() -> None:
    s = load_settings()
    if s["auto_enabled"] and len(log.recent(1000000)) - s["last_seq"] >= 30:
        consolidate_memory(is_auto=True)


@app.post("/api/consolidate")
def consolidate(x_admin_token: str = Header(default="")):
    """睡眠: 経験リプレイ＋忘却・剪定を実行し、自動スナップショットを取る。"""
    require_admin(x_admin_token)
    r = consolidate_memory(is_auto=False)
    return {"ok": True, **r, "stats": mem.stats()}


class SettingsIn(BaseModel):
    auto_learn: bool


@app.get("/api/settings")
def get_settings():
    s = load_settings()
    return {"auto_learn": s["auto_enabled"], "auto_runs": s["runs"], "last_auto_at": s["last_at"]}


@app.post("/api/settings")
def post_settings(body: SettingsIn, x_admin_token: str = Header(default="")):
    require_admin(x_admin_token)
    s = load_settings()
    s["auto_enabled"] = body.auto_learn
    save_settings(s)
    log.add([], "settings", f"auto_learn={body.auto_learn}", 0)
    return {"ok": True, "auto_learn": body.auto_learn}


class SnapshotIn(BaseModel):
    name: str


@app.get("/api/snapshots")
def snapshots():
    return sorted(p.stem for p in SNAP_DIR.glob("*.json"))


@app.post("/api/snapshot")
def snapshot(body: SnapshotIn, x_admin_token: str = Header(default="")):
    require_admin(x_admin_token)
    name = re.sub(r"[^\w\-]", "_", body.name) or "snapshot"
    mem.save(SNAP_DIR / f"{name}.json")
    return {"ok": True, "name": name}


@app.post("/api/snapshot/{name}/restore")
def restore(name: str, x_admin_token: str = Header(default="")):
    require_admin(x_admin_token)
    path = SNAP_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(404, "snapshot not found")
    mem.load(path)
    persist()
    log.add([], "restore", name, 0.0)
    return {"ok": True, "stats": mem.stats()}


@app.get("/api/guard")
def guard_list():
    return list(reversed(guard_queue))


@app.post("/api/guard/{gid}/decide")
def guard_decide(gid: int, approve: bool, x_admin_token: str = Header(default="")):
    require_admin(x_admin_token)
    for g in guard_queue:
        if g["id"] == gid and g["status"] == "pending":
            g["status"] = "approved" if approve else "rejected"
            log.add([], "guard_decide", f"#{gid} -> {g['status']}", 0.0)
            return {"ok": True, "item": g}
    raise HTTPException(404, "pending item not found")


# ---------------- 静的ファイル（Webアプリ） ----------------
STATIC = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(STATIC / "manifest.webmanifest", media_type="application/manifest+json")
