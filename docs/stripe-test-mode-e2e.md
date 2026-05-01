# Stripe Test Mode E2E 検証手順

## 目的

サポーター登録のStripe決済フローを、本番有効化前にStripe test modeとNetlify Preview環境だけでE2E検証する。

この手順では、Checkout、キャンセル、Customer Portal、解約、Webhook、Supabase上のサポーター状態が期待どおりに連動することを確認する。

## 前提

- Productionでは、まだ `SUPPORTER_PAYMENTS_ENABLED` を有効化しない。
- Preview環境だけでStripe test modeを有効化する。
- Stripeのキーは必ずtest mode用を使う。本番用のlive modeキーは使わない。
- サポーター扱いにするステータスは `active` / `trialing` のみ。
- `past_due` / `canceled` / `unpaid` はサポーター扱いにしない。
- 手動でSupabaseだけにサポーターステータスを付けたユーザーでは、Stripe Customer Portalの検証はできない。
- Donationは任意支援であり、サポーター登録とは別扱い。Donationの有無で機能差は発生させない。
- 本番で `SUPPORTER_PAYMENTS_ENABLED=true` にする前に、FF Logs側の商用利用許可を取得する。

## 必要なStripe Test Mode設定

Stripe Dashboardでtest modeに切り替え、以下を用意する。

- サポーター登録用の商品
- 月額のrecurring price
- test mode用の `STRIPE_SECRET_KEY`
- test mode用の `STRIPE_PRICE_ID`
- test mode用Webhook endpointの `STRIPE_WEBHOOK_SECRET`
- Customer Portalの有効化
- Webhook endpointの設定

秘密鍵やWebhook secretの実値は、この手順書やGit管理下のファイルに書かない。

### 商品と価格

Stripe test modeで商品と月額価格を作成する。

- 商品名は内部管理しやすい名前でよい。
- 価格は現在のサポーター登録月額と一致させる。
- 課金間隔はmonthlyにする。
- 作成後、test modeの `price_...` を控える。

### Customer Portal

Stripe test modeのCustomer Portal設定で、少なくとも以下を有効にする。

- サブスクリプションの解約
- 支払い方法の更新
- 必要に応じて請求履歴の表示

解約できない設定のままだと、サイト側の `サポーター登録を管理` ボタンからPortalに入れても解約テストが完了しない。

## Netlify Preview環境変数

NetlifyのPreview環境だけに以下を設定する。Productionにはまだ設定しない、または `SUPPORTER_PAYMENTS_ENABLED` をfalse相当にしておく。

```text
SUPPORTER_PAYMENTS_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

URL制御用に以下もPreview URLへ向ける。

```text
STRIPE_SUCCESS_URL=https://<preview-deploy>.netlify.app/?payment=success
STRIPE_CANCEL_URL=https://<preview-deploy>.netlify.app/premium.html?checkout=cancel
STRIPE_PORTAL_RETURN_URL=https://<preview-deploy>.netlify.app/premium.html
SUPPORTER_ALLOWED_ORIGINS=https://<preview-deploy>.netlify.app
```

設定後、Previewを再デプロイしてNetlify Functionsに環境変数を反映させる。

## Webhook Endpoint設定

Stripe Dashboardのtest modeでWebhook endpointを作成する。

```text
https://<preview-deploy>.netlify.app/api/stripe-webhook
```

購読するイベント:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

Webhook endpoint作成後、test modeのsigning secretをNetlify Previewの `STRIPE_WEBHOOK_SECRET` に設定する。

## Checkout成功テスト

1. Preview URLを開く。
2. テストユーザーでログインする。
3. `/premium.html` を開く。
4. `登録内容を確認する` を押す。
5. 確認モーダルで以下が明記されていることを確認する。
   - サポーター登録は月額自動更新であること
   - 解約されるまで毎月決済されること
   - 解約方法
   - 解約後の利用可能期間
   - 返金条件
   - FINAL FANTASY XIVの画像・名称・アイコン等やFF Logs API利用権を販売するものではないこと
6. `上記に同意してStripe決済へ進む` を押す。
7. Stripe Checkoutでtest modeの成功カードを使って決済する。
8. `STRIPE_SUCCESS_URL` にリダイレクトされることを確認する。

Supabaseで確認する。

```sql
select *
from public.billing_customers
where user_id = '<test-user-id>';

select *
from public.billing_subscriptions
where user_id = '<test-user-id>';
```

期待結果:

- `billing_customers.stripe_customer_id` に `cus_...` が入る。
- `billing_subscriptions.status` が `active` または `trialing` になる。
- `current_period_end` が未来日時になる。
- `/api/auth-status` が `isPremium: true` を返す。
- サポーター向け機能が利用できる。
  - ブックマーク保存・一覧
  - ボス詠唱表示
  - 広告非表示
  - FF Logs連携上限の拡張

## Checkoutキャンセルテスト

1. 別のテストユーザーでログインする、または前回テスト状態をクリアする。
2. `/premium.html` を開く。
3. `登録内容を確認する` を押す。
4. Stripe Checkoutへ進む。
5. Stripe Checkout画面でキャンセルする。
6. `STRIPE_CANCEL_URL` に戻ることを確認する。

期待結果:

- 対象ユーザーに有効な `billing_subscriptions` が作成されない。
- `/api/auth-status` が `isPremium: true` を返さない。
- 無料の基本機能は引き続き利用できる。

## Customer Portal確認

Checkout成功済みのテストユーザーで確認する。

1. `/premium.html` を開く。
2. `サポーター登録を管理` を押す。
3. Stripe Customer Portalへ遷移することを確認する。
4. Portal上に対象サブスクリプションが表示されることを確認する。
5. Portalから戻る。

期待結果:

- `No supporter registration was found for this account.` が出ない。
- Portalがログイン中ユーザーのStripe customerに紐づいている。
- クライアントから任意の `customer_id` を渡さなくてもPortalが開く。

エラーが出る場合は、Supabaseで `billing_customers` を確認する。

```sql
select *
from public.billing_customers
where user_id = '<test-user-id>';
```

行が存在しない場合、そのユーザーはStripe Checkoutを通っておらず、Supabaseで手動付与された可能性が高い。

## 解約確認

Customer Portalで解約を実行する。

1. `サポーター登録を管理` からCustomer Portalへ入る。
2. サブスクリプションを解約する。
3. `/premium.html` に戻る。
4. Stripe Dashboardで `customer.subscription.updated` または `customer.subscription.deleted` のWebhook deliveryを確認する。

Supabaseで確認する。

```sql
select status, current_period_end, cancel_at_period_end, updated_at
from public.billing_subscriptions
where user_id = '<test-user-id>'
order by updated_at desc;
```

期間終了時解約の場合の期待結果:

- `cancel_at_period_end = true`
- `status` は `active` のままでもよい。
- `current_period_end` まではサポーター扱いが続く。

完全に終了した後の期待結果:

- `status = canceled`
- `/api/auth-status` が `isPremium: false` を返す。
- サポーター向け機能はブロックまたは登録ページへ誘導される。

## invoice.payment_succeeded確認

Stripe test modeで、対象サブスクリプションの請求成功イベントを発生させる。

確認項目:

- Stripe DashboardのEventsに `invoice.payment_succeeded` が出る。
- Webhook deliveryがPreview endpointへ成功する。
- Supabaseの `stripe_webhook_events` にイベントが記録される。
- `processed_at` が入る。
- `billing_subscriptions` の `status` と `current_period_end` がStripe側と同期する。

確認SQL:

```sql
select stripe_event_id, type, processed_at, created_at
from public.stripe_webhook_events
where type = 'invoice.payment_succeeded'
order by created_at desc
limit 10;
```

## invoice.payment_failed確認

Stripe test modeで、失敗する支払い方法またはtest clockを使って請求失敗イベントを発生させる。

確認項目:

- Stripe DashboardのEventsに `invoice.payment_failed` が出る。
- Webhook deliveryがPreview endpointへ成功する。
- Supabaseの `stripe_webhook_events` にイベントが記録される。
- `processed_at` が入る。
- Stripe subscriptionの状態が `past_due` または `unpaid` になった場合、サイト側ではサポーター扱いにならない。

確認SQL:

```sql
select stripe_event_id, type, processed_at, created_at
from public.stripe_webhook_events
where type = 'invoice.payment_failed'
order by created_at desc
limit 10;

select status, current_period_end, cancel_at_period_end, updated_at
from public.billing_subscriptions
where user_id = '<test-user-id>'
order by updated_at desc;
```

期待結果:

- `status` が `past_due` / `unpaid` の場合、`/api/auth-status` は `isPremium: false` を返す。
- `active` / `trialing` の場合だけ `isPremium: true` になる。

## サポーター状態の確認

各テスト後に `/api/auth-status` とSupabaseを確認する。

有効扱い:

```text
active
trialing
```

無効扱い:

```text
past_due
canceled
unpaid
```

確認SQL:

```sql
select status, current_period_end, cancel_at_period_end
from public.billing_subscriptions
where user_id = '<test-user-id>'
order by updated_at desc;
```

## 失敗時に見るログ

### Netlify Function Logs

Preview deployのFunction logsを見る。

- `create-checkout`
- `create-portal-session`
- `stripe-webhook`

見るポイント:

- `Supporter registration is not enabled yet.`
- `Checkout is not configured.`
- `Customer Portal is not configured.`
- `Invalid signature`
- Stripe APIから返ったエラー

### Stripe Dashboard

Stripe test modeで以下を確認する。

- Events
- Webhook delivery logs
- Checkout session
- Customer
- Subscription
- Invoice
- Payment method

見るポイント:

- Webhook endpoint URLがPreview URLになっているか。
- Webhook signing secretがPreview envと一致しているか。
- イベントのdelivery statusが2xxか。
- subscription metadataに `user_id` が入っているか。

### Supabase / Auth / DB

確認対象:

- `auth.users`
- `billing_customers`
- `billing_subscriptions`
- `stripe_webhook_events`

確認例:

```sql
select id, email
from auth.users
where email = '<test-user-email>';

select *
from public.billing_customers
where user_id = '<test-user-id>';

select *
from public.billing_subscriptions
where user_id = '<test-user-id>';

select stripe_event_id, type, processed_at, created_at
from public.stripe_webhook_events
order by created_at desc
limit 20;
```

## 本番有効化前チェックリスト

- Preview環境だけで `SUPPORTER_PAYMENTS_ENABLED=true` にして検証した。
- Productionではまだ `SUPPORTER_PAYMENTS_ENABLED` を有効化していない。
- Checkout成功を確認した。
- Checkoutキャンセルを確認した。
- Customer Portalを確認した。
- Customer Portalから解約できることを確認した。
- `invoice.payment_succeeded` を確認した。
- `invoice.payment_failed` を確認した。
- Webhook deliveryが2xxで成功している。
- `stripe_webhook_events.processed_at` が入る。
- `billing_customers` にStripe customer IDが入る。
- `billing_subscriptions` がStripe subscriptionと同期している。
- `active` / `trialing` のみサポーター扱いになる。
- `past_due` / `canceled` / `unpaid` はサポーター扱いにならない。
- サポーター登録ページ、利用規約、プライバシーポリシー、特商法ページの文面を確認した。
- Donationが任意支援であり、機能差を発生させないことを確認した。
- FF Logs側の商用利用許可を取得した。
- Production用のStripe live mode商品・価格を確認した。
- Production用Webhook endpointを作成した。
- Production用の `STRIPE_WEBHOOK_SECRET` を取得した。
- Production用URLを設定した。

Production用URL例:

```text
STRIPE_SUCCESS_URL=https://xiv-srd.com/?payment=success
STRIPE_CANCEL_URL=https://xiv-srd.com/premium.html?checkout=cancel
STRIPE_PORTAL_RETURN_URL=https://xiv-srd.com/premium.html
SUPPORTER_ALLOWED_ORIGINS=https://xiv-srd.com
```

すべて完了してから、Productionで以下を設定する。

```text
SUPPORTER_PAYMENTS_ENABLED=true
```

## 検証記録欄

```text
Preview URL:
Stripe test product ID:
Stripe test price ID:
Stripe test webhook endpoint ID:
Test user email:
Checkout success:
Checkout cancel:
Customer Portal:
Cancellation:
invoice.payment_succeeded:
invoice.payment_failed:
active/trialing supporter status:
past_due non-supporter status:
canceled non-supporter status:
unpaid non-supporter status:
stripe_webhook_events processed_at:
Production still disabled:
FF Logs commercial permission:
Reviewer:
Date:
Notes:
```
