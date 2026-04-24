# Handoff

Updated: 2026-04-24

## 現在の状態

- Active branch: `main`
- 本番URL: `https://xiv-srd.com`
- フェーズ1〜3の実装完了・mainにマージ済み

---

## 完了済みの実装（フェーズ1〜3）

### フェーズ1：DB基盤

- `supabase/migrations/20260424000001_membership.sql`
  - 5テーブル定義とRLS設定済み（billing_customers / billing_subscriptions / comparison_daily_usage / comparison_bookmarks / stripe_webhook_events）
  - Supabase本番DBに適用済み

### フェーズ2：サーバーサイドAPI

- `lib/billing.js` — 有料判定・比較回数・Supabase書き込みのヘルパー
- `netlify/functions/stripe-webhook.js` — Stripe Webhookの受信・処理
- `netlify/functions/check-usage.js` — 比較回数チェック＆カウントアップ
- `netlify/functions/supabase-config.js` — フロント向けSupabase公開設定API

### フェーズ3：認証UI

- `scripts/auth/auth.js` — Supabase Auth初期化・ログイン/ログアウト（`globalThis.AuthModule`）
- `scripts/auth/auth-ui.js` — ヘッダーUI・ログインモーダル（`globalThis.AuthUIModule`）
- `index.html` — importmap・headerAuthArea・ログインモーダル追加済み
- `styles.css` — 認証UI用スタイル追加済み

---

## 環境変数（Netlify設定済み）

| 変数名 | 説明 |
|--------|------|
| `SUPABASE_URL` | Supabase プロジェクトURL |
| `SUPABASE_ANON_KEY` | Supabase 公開キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名シークレット |
| `ADMIN_EMAILS` | 管理者メールアドレス |
| `GEMINI_API_KEY` | Gemini API キー |

**フェーズ4で追加が必要な環境変数：**

| 変数名 | 説明 |
|--------|------|
| `STRIPE_PRICE_ID` | Stripeで作成した月額プランの価格ID（`price_...`） |

---

## コード規約（必ず守ること）

### Netlify Functions（サーバーサイド）

- **CommonJS形式**（`require` / `module.exports` / `exports.handler`）
- **Supabase SDK不使用** — `fetch` APIで直接REST APIを叩く
- `lib/billing.js` のヘルパーを使ってDB操作を行う
- `lib/runtime-env.js` の `readRuntimeEnv()` で環境変数を読む
- レスポンス形式は `{ ok: boolean, ... }`

### フロントエンドJS

- **ESモジュール形式**（`type="module"`）
- モジュール間の共有は **`globalThis.*`** を使う（例: `globalThis.AuthModule`）
- Supabase Auth操作は `globalThis.AuthModule` 経由で行う
- 認証状態確認は `globalThis.AuthModule.getSession()` / `getUser()` を使う

---

## フェーズ4の実装仕様

### Step 1: Stripeで価格を作成（手動操作・コード不要）

1. Stripeダッシュボード → 製品カタログ → 「製品を追加」
2. 製品名: 「有料会員」
3. 価格: 200円 / 月（定期課金）
4. 作成後に表示される **価格ID**（`price_...`）をコピー
5. Netlify環境変数に `STRIPE_PRICE_ID` として追加

### Step 2: netlify/functions/create-checkout.js を新規作成

StripeのCheckout Sessionを作成してURLを返すAPI。

- エンドポイント: `POST /api/create-checkout`
- Authorizationヘッダー（Bearer JWT）からSupabase経由でuser_idを取得
  - `lib/billing.js` の `getUserIdFromJWT(jwt)` を使う
- ログインしていない場合は 401 を返す
- Stripe APIはSDKなしで `fetch` を使って叩く
- Checkout Session作成パラメータ:
  - `mode=subscription`
  - `line_items[0][price]={STRIPE_PRICE_ID}`
  - `line_items[0][quantity]=1`
  - `metadata[user_id]={userId}` （checkout.session.completedのWebhookで使う）
  - `subscription_data[metadata][user_id]={userId}` （subscription系Webhookで使う）
  - `success_url={origin}/?payment=success`
  - `cancel_url={origin}/premium.html`
- 成功時: `{ ok: true, url: checkoutUrl }` を返す

Stripeへのリクエスト方法（SDKなし）:
```
POST https://api.stripe.com/v1/checkout/sessions
Authorization: Bearer {STRIPE_SECRET_KEY}
Content-Type: application/x-www-form-urlencoded
```
URLSearchParamsでボディを組み立てること。ネストしたパラメータは `line_items[0][price]=xxx` の形式。

### Step 3: netlify/functions/auth-status.js を新規作成

フロントが認証状態・プラン・残り回数を取得するためのAPI。

- エンドポイント: `GET /api/auth-status`
- Authorizationヘッダー（Bearer JWT）でユーザー確認
  - `lib/billing.js` の `getUserIdFromJWT(jwt)` を使う
- 戻り値:
  ```json
  {
    "ok": true,
    "isLoggedIn": true/false,
    "isPremium": true/false,
    "remaining": 数値（有料会員は9999）
  }
  ```

### Step 4: premium.html を新規作成

有料プランの機能紹介ページ。

- ファイル: `premium.html`
- 既存の `contact.html` や `privacy.html` と同じHTMLの骨格を使うこと
- 表示内容:
  - 有料会員の特典（広告非表示 / 比較回数無制限 / ブックマーク最大100件）
  - 価格: 月額200円（税込）
  - 「今すぐ始める（200円/月）」ボタン → `/api/create-checkout` を叩いてStripe Checkoutへリダイレクト
  - 未ログイン時は先にログインモーダルを表示してから課金へ
- `globalThis.AuthModule` を使って認証状態を確認する

### Step 5: シナジーTLの有料判定

シナジーTL（SynergyTimeline）の表示操作に有料判定を追加する。

対象: `scripts/ui/timeline.js` 内のシナジーTL関連処理（関数名は要確認）

- 有料会員: そのまま表示
- 無料会員・未ログイン: `premium.html` へリダイレクト（またはモーダルで案内）

### Step 6: 比較回数チェックの組み込み

**⚠️ 重要: check-usage APIは `compareBtn` のクリック時にのみ呼ぶこと。**
**`restoreStateFromUrl` などのURL復元処理では絶対に呼ばない。**

理由: リロード時の自動復元は「新しい比較」ではないため、カウントアップすると二重消費になる。

対象: `scripts/app/bootstrap.js` の `compareBtn` クリックハンドラー

- compareBtn クリック時に `POST /api/check-usage` を呼ぶ
- Authorization ヘッダーに `globalThis.AuthModule.getSession()` のJWTを付ける
- 429 (Daily limit reached) → 「1日30回の上限に達しました。有料会員なら無制限です。」を表示
- 200 OK → 残り回数を `headerAuthArea` に更新表示して比較を続行

### Step 7: netlify.toml に新規エンドポイントを追記

```toml
[[redirects]]
  from = "/api/create-checkout"
  to = "/.netlify/functions/create-checkout"
  status = 200

[[redirects]]
  from = "/api/auth-status"
  to = "/.netlify/functions/auth-status"
  status = 200
```

---

## フェーズ5の実装仕様

### Step 8: ブックマーク機能

Netlify Function `netlify/functions/bookmarks.js` を新規作成:

- `GET /api/bookmarks` — ユーザーのブックマーク一覧（有料会員のみ）
- `POST /api/bookmarks` — ブックマーク追加（有料会員のみ・100件上限）
- `DELETE /api/bookmarks?id={id}` — ブックマーク削除

全エンドポイント共通:
- Authorizationヘッダー必須
- `lib/billing.js` の `isUserPremium(userId)` でプラン確認
- 非有料会員は 403 を返す

ブックマークデータ（`comparison_bookmarks.data`）に保存する内容:
- 現在の比較状態（URL A/B、プレイヤーA/B、ファイト選択など）
- `buildSharedStateQuery()` の結果を使う（`scripts/shared/app-utils.js` 参照）

フロント側（`scripts/auth/auth-ui.js` または専用の `scripts/auth/bookmark-ui.js`）:
- 比較結果表示時に「ブックマーク保存」ボタンを表示
- ブックマーク一覧をサイドバーまたはモーダルで表示
- 100件上限到達時は新規保存ボタンを無効化（自動削除しない）

### Step 9: 広告非表示制御

有料会員の場合、ヘッダー広告（`.header-ad`）と本文内広告を非表示にする。

対象: `scripts/auth/auth-ui.js` の `renderHeaderAuth()` 関数内

```javascript
// isPremiumがtrueの場合
document.querySelectorAll('.header-ad, .adsbygoogle').forEach(el => {
  el.style.display = 'none';
});
```

---

## プッシュ・デプロイ方針

- **mainへのgit pushは禁止**
- **git commitも禁止**（実装のみ行い、ユーザーが確認後にコミット・プッシュ）
- 変更・未追跡ファイルを勝手にrevert/cleanupしない

---

## 既存の主要ファイル

| ファイル | 役割 |
|---------|------|
| `lib/billing.js` | 有料判定・DB操作ヘルパー |
| `lib/db.js` | app_events等のDB操作 |
| `lib/runtime-env.js` | 環境変数読み取り |
| `scripts/auth/auth.js` | Supabase Auth（`globalThis.AuthModule`） |
| `scripts/auth/auth-ui.js` | ヘッダー認証UI（`globalThis.AuthUIModule`） |
| `scripts/app/bootstrap.js` | UI全体のイベント配線・compare処理 |
| `scripts/app/main.js` | エントリポイント（import一覧） |
| `netlify/functions/check-usage.js` | 比較回数チェックAPI |
| `netlify/functions/stripe-webhook.js` | Stripe Webhookハンドラ |
