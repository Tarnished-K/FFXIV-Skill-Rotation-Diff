# Supporter Production Operations

Last updated: 2026-05-01

This memo covers routine production checks for supporter registration, Stripe webhook delivery, Netlify Function logs, Supabase billing tables, refunds, duplicate payments, and support inquiries.

## 2026-05-01 Production Check Notes

Confirmed from the local Netlify project link and CLI:
- Current Netlify project: `vermillion-crumble-a1f1aa`
- Production URL: `https://xiv-srd.com`
- Project ID: `f80941de-2510-465f-bd17-294483c809fb`
- The following functions are deployed: `stripe-webhook`, `create-checkout`, `create-portal-session`, `auth-status`, and the other current site functions.
- Required Stripe/Supabase/supporter environment variable names exist in Netlify and were displayed masked by Netlify CLI.

Not completed in this pass:
- Supabase table contents were not inspected because BrowserMCP returned `Transport closed` when opening the Supabase dashboard.
- Stripe Dashboard live-mode event details were not inspected in-browser in this pass.

Follow-up:
- Reopen Supabase dashboard for project `qywkgixcsnzepiruuzda` with BrowserMCP and inspect the three billing tables listed below.
- Confirm the latest live Stripe webhook event in Stripe Dashboard and correlate its event ID with `stripe_webhook_events.processed_at`.
- After 2026-06-01, confirm the canceled production test account is no longer treated as supporter.

## Routine Payment Verification

1. Open Stripe Dashboard in live mode.
2. Check the latest Checkout Session and Subscription for the production supporter account.
3. Confirm the subscription status is one of:
   - `active`: treated as supporter.
   - `trialing`: treated as supporter.
   - `past_due`, `canceled`, or `unpaid`: not treated as supporter.
4. Open the site with the same account and call `/api/auth-status` through the normal logged-in UI path.
5. Confirm the UI reports supporter status only when Stripe and Supabase both reflect an active supporter state.

For the canceled production test account, confirm after 2026-06-01 that it is no longer treated as supporter.

## Stripe Webhook Resend Verification

Use this when a Checkout, subscription update, cancellation, invoice payment, or invoice failure appears missing from Supabase.

1. In Stripe Dashboard live mode, open Developers > Webhooks.
2. Select the production webhook endpoint.
3. Open the relevant event, such as:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Use resend for the event.
5. Confirm Netlify Function logs show a successful `stripe-webhook` invocation.
6. Confirm `stripe_webhook_events.processed_at` is populated for that event ID.
7. Confirm `billing_customers` and `billing_subscriptions` match the Stripe customer and subscription state.

Never paste webhook signing secrets, bearer tokens, Supabase service keys, or Stripe secret keys into chat, commits, screenshots, or issue text.

## Netlify Function Log Flow

1. Open Netlify production site dashboard.
2. Go to Functions.
3. Inspect logs for:
   - `stripe-webhook`
   - `create-checkout`
   - `create-portal-session`
   - `auth-status`
4. Filter by the approximate time of the Stripe event or user report.
5. Record only non-secret identifiers in notes:
   - Stripe event ID.
   - Stripe customer ID suffix only if sharing externally.
   - Supabase user ID only in private admin notes.
   - HTTP status and error category.

If logs show signature verification failures, check that the live Stripe endpoint signing secret matches the Netlify production environment variable. Do not print the secret value.

## Supabase Tables To Inspect

Use Supabase production project only when investigating production supporter state.

`billing_customers`:
- Check `user_id`.
- Check Stripe customer ID mapping.
- Confirm the billing mode matches the current environment.

`billing_subscriptions`:
- Check Stripe subscription ID.
- Check status.
- Check current period start and end.
- Check cancellation flags or canceled timestamp if present.

`stripe_webhook_events`:
- Check Stripe event ID.
- Check event type.
- Check `processed_at`.
- If `processed_at` is empty, inspect Netlify logs and consider Stripe resend.

## Supporter Status Troubleshooting

When a user says supporter status is not reflected:

1. Ask them to confirm the login method and email used on the site.
2. Confirm whether Checkout completed or was canceled.
3. Inspect Stripe live mode for the customer and subscription.
4. Inspect Supabase `billing_customers` and `billing_subscriptions`.
5. Check `stripe_webhook_events` for the relevant event ID.
6. If webhook processing failed or never arrived, resend the Stripe event.
7. Ask the user to log out and log back in only after backend state is confirmed.

If Stripe shows `past_due`, `canceled`, or `unpaid`, the user should not be treated as supporter.

## Refunds, Duplicate Payments, And Inquiries

Refunds:
- Completed digital service payments are generally non-refundable per the current user-facing copy.
- Handle duplicate payments or exceptional cases individually.
- If refunding, process from Stripe Dashboard and document the Stripe payment or invoice ID in private admin notes.

Duplicate payments:
- Check whether multiple Checkout Sessions created multiple subscriptions.
- Cancel the unintended duplicate subscription in Stripe if needed.
- Refund the duplicate payment if appropriate.
- Confirm Supabase keeps only the intended active subscription as supporter state.

Support inquiries:
- Do not ask users for secret tokens or full payment credentials.
- Accept email address, rough payment time, and last four digits only if needed for support matching.
- Keep public replies free of Stripe customer IDs, Supabase user IDs, and operational secrets.

## Environment Variable Safety

Production Netlify variables should be checked by name, not by revealing values:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- Checkout and portal return URL variables if configured.

If a value may have been exposed, rotate it instead of reusing it.
