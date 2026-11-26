# Synaptic AI — 体を持たないシナプス型自律AI（プロトタイプ）

シナプスの集合体で継続学習するAIの最小実装。
連絡手段と管理画面を兼ねたWebアプリとして動く。GPU不要。

## 構成
- `app/synapse_core.py` — シナプス記憶コア（ヘブ則＋報酬変調、忘却・剪定、重要度保護、スナップショット）
- `app/main.py` — FastAPIバックエンド（チャット／フィードバック／記憶グラフ／経験ログ／承認キュー／睡眠）
- `app/static/index.html` — Webアプリ（連絡チャット＋管理画面、PWA対応）
- `data/` — 状態・経験ログ・スナップショット（自動生成）

## 起動
```bash
cd ~/workspace/synaptic-ai
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd app && ../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8077
```
ブラウザで http://127.0.0.1:8077 を開く。

管理操作（スナップショット復元・承認・睡眠）を保護する場合は、
起動前に `ADMIN_TOKEN` 環境変数を設定し、管理画面で同じトークンを入力する。

## 安全設計
- 不可逆操作（送信・削除・公開・決済など）を含む依頼は、学習層では実行せず承認キューに回す
- 学習の状態はスナップショットでいつでも巻き戻せる
- 経験は追記専用ログに残り、学習が壊れても再生できる

## テスト
```bash
.venv/bin/python tests/test_core.py
```

## Cloudflare 版（本番・公開用）
同じWebアプリを Cloudflare Workers で動かす版が `cloudflare/` にある。

- `cloudflare/src/worker.js` — Worker本体（API＋シナプスコアのJS移植）
- `cloudflare/src/ui.js` — WebアプリのUI
- `cloudflare/build.mjs` — 単一ファイル `dist/index.js` へのバンドル（依存なし）
- `cloudflare/wrangler.toml` — wrangler でデプロイする場合の設定

### ストレージ（後から差し替え可能）
状態の保存は **ストレージアダプタ** の後ろに隠してある。
`worker.js` の `createStore(env)` が実装を選ぶだけで、AI本体は保存先を知らない。

- 現在の実装: `D1Store`（D1を key-value テーブル `kv_store` として使用）
- バインディングが無い場合: `MemoryStore`（揮発性・開発用）
- 後から外部ストレージ（R2 / KV / 独自REST APIなど）を接続する場合は、
  `loadBrain / saveBrain / saveSnapshot / loadSnapshot / listSnapshots`
  の5メソッドを持つクラスを追加し、`createStore()` に分岐を1つ足す。

### デプロイ手順（wrangler）
```bash
cd cloudflare
node build.mjs
npx wrangler d1 create synaptic-ai   # 初回のみ。uuid を wrangler.toml に記入
npx wrangler d1 execute synaptic-ai --remote --command "CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
npx wrangler deploy
```
