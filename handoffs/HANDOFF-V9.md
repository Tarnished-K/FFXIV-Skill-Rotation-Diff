# HANDOFF V9 - Stripe / Supporter Roadmap

Date: 2026-04-30
Branch: `feature/sidebar-premium-shell-i18n`
Latest pushed code before this handoff:
- `396fe11 Keep setup cards visible on reset`
- Preview: `https://69f33486a17b6cf8b3f23487--vermillion-crumble-a1f1aa.netlify.app`

This handoff is for the next session. The goal is not just to start this work; it is to complete the roadmap below end-to-end and bring supporter registration / Stripe readiness to a production-ready state, without changing the business framing away from "supporter".

## Core Product Policy

Use "サポーター" / "Supporter" for user-facing paid/support language.

Do not market the plan as:
- Pro
- Premium
- paid member
- 有料会員
- subscription plan
- professional plan

Internal names such as `isPremium`, `premium`, `requirePremiumFeature`, `premium.html`, and `premium-preview.js` may remain for now. Do not do a broad internal rename unless explicitly requested; first finish user-facing copy, legal readiness, and payment correctness.

Supporter registration must not be framed as selling access to FINAL FANTASY XIV images, names, icons, or FF14 assets. The supporter value should be framed as site-side convenience:
- 当サイト独自の解析処理
- 保存機能
- FF Logs連携上限 / 解析回数上限の拡張
- 広告非表示
- ブックマーク
- ボス詠唱表示
- 今後追加する利便性機能

Avoid:
- FF Logs API無制限
- APIを叩く権利を販売
- FF14アセットを使った機能がサポーターで解放
- サポーターだけシナジー/デバフ/PT比較が使える

## Current Stripe / Supporter State

Stripe Checkout is partially implemented:
- Function: `netlify/functions/create-checkout.js`
- Route: `/api/create-checkout`
- Uses env names:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PRICE_ID`
- `mode=subscription`
- Price ID comes from server env, not from client input.
- Login is required via Supabase JWT.
- Metadata currently includes `metadata[user_id]` and `subscription_data[metadata][user_id]`.
- Success URL: `${origin}/?payment=success`
- Cancel URL: `${origin}/premium.html`

But the current UI does not allow checkout:
- `premium.html` has `supporterCheckoutBtn` disabled.
- `startCheckout()` immediately shows "サポーター登録は準備中です。" and returns.
- Therefore payments are effectively disabled from UI.

Webhook is partially implemented:
- Function: `netlify/functions/stripe-webhook.js`
- Route: `/api/stripe-webhook`
- Uses env name:
  - `STRIPE_WEBHOOK_SECRET`
- Verifies Stripe signature manually with HMAC.
- Handles:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Does not handle:
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Records events in `stripe_webhook_events` and skips duplicate event IDs.
- `processed_at` exists in schema but is not updated.
- Netlify base64 encoded raw body is not explicitly handled.

Supporter state is stored in Supabase:
- Migration: `supabase/migrations/20260424000001_membership.sql`
- Tables:
  - `billing_customers`
  - `billing_subscriptions`
  - `comparison_daily_usage`
  - `comparison_bookmarks`
  - `stripe_webhook_events`

Supporter check:
- File: `lib/billing.js`
- Function: `isUserPremium(userId)`
- Internal naming still uses premium.
- Checks `billing_subscriptions` where:
  - `status in (active, trialing, past_due)`
  - `current_period_end >= now`
- `past_due` currently still counts as supporter. Decide if that is intended.

Usage limits:
- File: `lib/billing.js`
- Guest: `ANON_DAILY_LIMIT = 5`
- Free logged-in user: `FREE_USER_DAILY_LIMIT = 15`
- Supporter: returns `9999`
- These are code constants, not env-configurable.

Customer Portal is not implemented:
- No portal session function found.
- No "サポーター登録を管理" / cancel / next billing date UI found.
- Need to implement before real paid launch.

## User-Facing Copy Issues To Fix First

`premium.html` still contains user-visible "Pro" language:
- Static HTML:
  - `Proプランは...`
  - `Pro expands site-side convenience`
  - `Proでは...`
  - `Pro向け...`
- i18n copy:
  - `benefitsLead`
  - `focusTitle`
  - `focusBody`
  - `benefitConvenienceBody`
  - `previewLead`
  - English copy with `Pro provides`, `Pro expands`, `offered to Pro`

User request from latest interrupted UI task:
- Remove the whole focus block:
  - `Pro expands site-side convenience`
  - `デバフレーン、シナジーレーン、PT比較...`
- Change `Proプランは...` to `サポータープランは...`
- Keep that sentence on one line if possible.
- In feature preview:
  - remove `実際の画面`
  - enlarge `機能プレビュー`
  - do not say `Proでは`; use `サポータープランでは`
  - line 1 should end at `利用できます。`
  - line 2 should start with `サポータープランでは...`

`terms.html` issue:
- Donation section still says `有料会員プラン`.
- Replace user-facing wording with `サポーター登録` or `サポーター向け機能`, preserving the meaning that Donation is separate.

Do not remove the statement that debuff lane, synergy lane, and party comparison are free/basic visualizations unless the user specifically wants less explanatory text in that location.

## Legal / Policy Readiness

`commercial-transactions.html` currently says no paid service is being sold:
- "サポーター登録機能は現在準備中..."
- "現時点で有料サービスの販売、申込み受付、決済を行っていません。"

If Stripe launch is enabled, this page must be rewritten before production launch.

Needed Specified Commercial Transactions Act items:
- 販売事業者: 請求があった場合、遅滞なく開示
- 所在地: 請求があった場合、遅滞なく開示
- 電話番号: 請求があった場合、遅滞なく開示
- 問い合わせ先
- 販売価格: サポーター登録画面または購入ページの月額料金
- 商品代金以外の必要料金: 通信料金等は利用者負担
- 支払方法: クレジットカード決済（Stripe）
- 支払時期: 初回申込時、以後1か月ごとに自動更新
- 提供時期: 決済完了後、直ちにサポーター向け機能を利用可能
- 解約方法: アカウント設定画面またはStripe Customer Portal
- 解約後の扱い: 実装に合わせて明記
- 返金: 原則返金不可、重複決済/重大不具合等は個別対応
- 動作環境: 最新主要ブラウザ等

`privacy.html` currently conflicts with login/Stripe readiness:
- It says personally identifiable info such as names/email is not collected.
- For real login/supporter launch, update to mention:
  - account registration/login may collect email, provider identifiers, user ID
  - Google login provider data may be used
  - Stripe handles payment processing
  - site does not store full card numbers
  - site may store Stripe customer ID, subscription ID, plan/status, period end
  - usage logs, error logs, access time, usage counts may be stored for improvement/security

`terms.html` generally contains current support framing, but review after legal/Stripe launch changes.

## Payment Implementation Gaps

High priority before enabling payment:
1. Add checkout confirmation modal/page before redirecting to Stripe.
   It should show:
   - サポーター登録であること
   - 月額料金
   - 自動更新
   - 初回決済日 and monthly renewal
   - 解約方法
   - 解約後の利用可能期間
   - 返金条件
   - サポーター向け機能
   - FF14画像・名称・アイコン等へのアクセス販売ではない旨
   - Links to Terms / Privacy / Specified Commercial Transactions Act
   - "上記に同意してStripe決済へ進む"

2. Implement Stripe Customer reuse.
   Current checkout does not look up `billing_customers`; it may create duplicate Stripe customers for the same user.

3. Implement Customer Portal.
   Add server-only function such as `/api/create-portal-session`.
   Requirements:
   - Login required
   - Find current user's `stripe_customer_id`
   - Do not accept arbitrary customer ID from client
   - Return Stripe portal URL
   - UI label should be `サポーター登録を管理` or `サポーター管理`

4. Expand webhook handling.
   Add:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   Decide treatment for `past_due`.

5. Harden webhook raw body handling.
   Current code uses `event.body || ''`.
   Confirm Netlify payload mode. If `event.isBase64Encoded`, decode before signature verification.

6. Update `stripe_webhook_events.processed_at`.
   Current schema has it but code does not update it.

7. Consider env flags:
   - `SUPPORTER_PAYMENTS_ENABLED`
   - `STRIPE_SUCCESS_URL`
   - `STRIPE_CANCEL_URL`
   - `STRIPE_PORTAL_RETURN_URL`
   - Optional limit envs later

## Security Notes

Good:
- `STRIPE_SECRET_KEY` is only referenced server-side.
- `STRIPE_WEBHOOK_SECRET` is only referenced server-side.
- Client cannot pass arbitrary price ID to checkout.
- Checkout requires Supabase JWT.
- Server-side supporter checks use Supabase service role and subscription table, not localStorage.
- Webhook verifies Stripe signature before DB update.

Needs attention:
- Success/cancel URLs are based on request origin. For production, consider configured allowed URLs to avoid preview/origin confusion.
- Existing Customer reuse missing.
- Portal missing.
- `past_due` currently grants supporter state.
- Webhook raw body base64 handling uncertain.
- No checkout confirmation screen.
- No explicit payment enabled flag, while checkout code remains in page.

## Free vs Supporter Feature Boundary

Free/basic visualizations:
- Synergy lane
- Debuff lane
- Party comparison
- FF14 asset-containing basic visualizations

Supporter-appropriate:
- FF Logs連携上限 / 解析回数上限の拡張
- Bookmark
- Boss casts
- Ad-free
- Saved workflows / history if implemented
- Future convenience features

Current implementation notes:
- Synergy/debuff/PT compare are not supporter-gated in the current access-control path.
- Boss cast is gated in timeline layer controls via `layer === 'cast' && !state.isPremium`.
- Bookmarks API requires `isUserPremium`.
- Ads are hidden when `usageData.isPremium`.

Do not reintroduce gates or upgrade CTAs for synergy/debuff/PT compare.

## Donation Boundary

Donation is separate from supporter registration.

Current files:
- `scripts/shared/donation-config.js`
- `scripts/shared/donation.js`
- `premium.html#donation`

Current policy:
- Donation URL placeholder is empty.
- TODO comment says to set live donation URL later.
- Donation must not affect membership/supporter status.
- UI text should state Donation is optional and creates no feature difference.

Check Japanese text after mojibake-sensitive edits. Use existing file encoding carefully.

## Version Loading

Several pages include:
- `<small class="build-info" data-build-info>Version loading...</small>`

This is expected initial text because `scripts/shared/build-info.js` replaces it with:
- `Version vX.Y.Z · commit`
- or `Version unavailable`

If a page does not load `build-info.js`, then `Version loading...` remains and should be fixed. Current relevant pages appear to include the script.

## Next Session Completion Scope

In the next session, treat the roadmap items below as the completion target. The work should continue until the supporter registration flow, Stripe backend, legal/privacy pages, UI copy, and preview deployment are all consistent and verified, unless the user explicitly narrows scope or pauses the work.

Definition of done for that next session:
- User-facing terminology is unified to サポーター / Supporter.
- Tutorial login works from the guide page.
- Supporter registration UI is no longer contradictory with the actual payment state.
- If payments are enabled, legal/privacy pages and checkout confirmation are production-ready.
- Stripe Checkout reuses customers where appropriate.
- Stripe Webhook handling is hardened and covers required subscription/payment events.
- Customer Portal / supporter management is available before real paid launch.
- Free features remain free: synergy lane, debuff lane, party comparison, and basic FF14-asset visualizations.
- Donation remains separate and does not unlock features.
- Tests pass.
- Changes are committed to a non-main branch, pushed, and a Netlify preview URL is provided.

## Next Session Recommended Order

1. Do only user-facing copy cleanup first.
   - Remove Pro/Premium/user-visible old naming.
   - Keep internal `isPremium` names.
   - Run `rg` for user-visible old terms.

2. Fix tutorial login button.
   User reported: "初めての方向けガイドからログインボタンを押しても反応がありません."
   Likely cause: `tutorial.html` uses `site-shell.js` sidebar but does not import `scripts/auth/auth.js` / `scripts/auth/auth-ui.js`, so `globalThis.AuthUIModule` is undefined on that page.
   Proposed minimal fix:
   - Add Supabase importmap and auth modal markup, or
   - Add a login handler in site shell that navigates to `/?login=1`, then open modal on index.
   Choose the smallest consistent pattern.

3. Legal and privacy update.
   - Update `commercial-transactions.html` for launch readiness only if payments will be enabled.
   - Update `privacy.html` for login/Stripe data.
   - Update `terms.html` "有料会員プラン" wording.

4. Implement checkout confirmation modal/page.

5. Implement Customer Portal and supporter management UI.

6. Harden Stripe backend:
   - Customer reuse
   - invoice events
   - raw body/base64
   - processed_at
   - allowed URLs / env URL config
   - optional payment enabled flag

7. Enable checkout button only after legal/privacy/portal are complete.

## Verification Checklist For Next Session

Commands:
- `rg -n "\\bPro\\b|Premium|有料会員|paid member|subscription plan|professional plan" premium.html terms.html privacy.html commercial-transactions.html index.html tutorial.html scripts -S`
- `rg -n "FF Logs API無制限|APIを叩く|FF14アセット.*解放|シナジー.*サポーター|デバフ.*サポーター|PT比較.*サポーター" . -S`
- `npm test`
- `node --check netlify/functions/create-checkout.js`
- `node --check netlify/functions/stripe-webhook.js`

Manual/preview:
- Open `/premium.html`
- Open `/tutorial.html`, click login from sidebar
- Verify Donation still says optional/no feature difference
- Verify legal pages match whether payment is enabled or still preparing

Deployment rule from user:
- Do not commit to `main`.
- Commit to the current feature branch or another non-main branch.
- Push the branch.
- Provide Netlify preview URL every time.
