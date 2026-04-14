# FFXIV Skill Rotation Diff

公開 FFLogs ログを 2 件読み込み、戦闘ごとのプレイヤータイムラインを比較するツールです。

## 現在の方針
- 対応対象は公開ログのみ
- ユーザーごとの FF Logs OAuth / PKCE は使わない
- FF Logs API は Netlify Functions 経由で呼び出す
- 利用状況分析は Supabase へ保存できる構成にする

## 主な構成
- `index.html`
  比較画面
- `tutorial.html`
  初回ガイド
- `scripts/`
  フロントの UI / FF Logs データ整形 / タイムライン描画
- `netlify/functions/fflogs-proxy.js`
  FF Logs GraphQL をサーバー側資格情報で中継
- `netlify/functions/log-event.js`
  利用イベント保存の入口
- `lib/fflogs-client.js`
  FF Logs public API 通信用の共通部品
- `lib/db.js`
  Supabase 保存用の共通部品
- `supabase/schema.sql`
  最小のイベント保存テーブル定義

## 必要な環境変数
`.env.example` を参照してください。

- `FFLOGS_CLIENT_ID`
- `FFLOGS_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## ローカル起動
Netlify Functions を使うため、単純な静的サーバーではなく `netlify dev` を使います。

```bash
netlify dev
```

起動後は通常 `http://localhost:8888` で確認できます。

## API エンドポイント
- `/api/fflogs-proxy`
  フロントから FF Logs GraphQL を呼ぶ入口
- `/api/log-event`
  `page_view` や `comparison_completed` などのイベント保存用

## 補足
- 非公開ログは取得できません
- `public/job-icons/job_icon.json` と `public/job-icons/...` のアイコンを利用します
- 将来的に利用状況分析や要望管理を追加しても、`/api/*` 経由の構成を維持できるようにしています
