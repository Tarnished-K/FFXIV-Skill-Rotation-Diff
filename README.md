# FFXIV Skill Rotation Diff

FFLogs の公開ログを比較して、2 人のプレイヤーのタイムライン差分を確認するための静的サイトです。  
フロントは静的 HTML / JS、API は Netlify Functions、保存先は Supabase を使います。

## Main files
- `index.html`
  メイン画面
- `tutorial.html`
  使い方ガイド
- `contact.html`
  ご要望フォーム
- `feedback-admin.html`
  フィードバック管理画面
- `analytics.html`
  利用状況ダッシュボード
- `scripts/`
  フロントの UI / data 処理
- `netlify/functions/`
  FF Logs proxy、analytics、feedback、auth 用 API
- `lib/`
  Functions から使う共通ロジック
- `supabase/schema.sql`
  Supabase schema

## Required env
`.env.example` をコピーして設定してください。

- `FFLOGS_CLIENT_ID`
- `FFLOGS_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `GEMINI_API_KEY`
- `GEMINI_FEEDBACK_MODEL`

## Local dev
Functions も含めて確認する前提なので、静的サーバーではなく `netlify dev` を使います。

```bash
netlify dev
```

通常は `http://localhost:8888` で確認できます。

## API routes
- `/api/fflogs-proxy`
  FF Logs GraphQL proxy
- `/api/log-event`
  利用イベント保存
- `/api/analytics-summary`
  analytics 集計
- `/api/feedback-submit`
  フィードバック送信と AI 振り分け
- `/api/feedback-admin-*`
  フィードバック管理 API
- `/api/public-config`
  管理画面ログイン用の公開設定
- `/api/admin-session`
  管理者セッション確認

## Feedback
- `contact.html` から送信できます
- Gemini を使う場合は `GEMINI_API_KEY` と `GEMINI_FEEDBACK_MODEL` が必要です

## Admin auth
- `feedback-admin.html` と `analytics.html` は Supabase Auth で保護されています
- `ADMIN_EMAILS` はカンマ区切りの allowlist です
- Supabase Dashboard の `Auth > Users` で管理者ユーザーを作成してください
- そのメールアドレスを `ADMIN_EMAILS` に入れてください
- ブラウザ側は `SUPABASE_ANON_KEY` を使ってログインし、Functions 側で管理者メールを再確認します

## Notes
- 本番の公開ログだけを対象にしています
- ジョブアイコンは `public/job-icons/` を使います
- 管理 API は UI を隠すだけでは保護にならないので、必ず auth 設定を入れてください
