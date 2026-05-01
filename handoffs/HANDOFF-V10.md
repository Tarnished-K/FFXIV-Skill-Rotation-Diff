# HANDOFF V10 - Final QA / Supporter UX Roadmap

Date: 2026-05-01
Branch created for this handoff: `final-qa`
Base branch before creating this branch: `feature/sidebar-premium-shell-i18n`

This handoff is for the next session. The next session should continue on `final-qa`, perform final QA-oriented implementation, commit changes, push the branch, and provide a Netlify Preview URL for browser verification.

## Current State

Payment/supporter implementation is broadly stable.

Already completed:
- Stripe live Checkout works.
- Stripe Customer Portal opens for the production supporter account.
- Cancellation was tested from Customer Portal.
- Webhook signing secret alignment was fixed.
- Stripe webhook delivery was verified after redeploy.
- `billing_customers` and `billing_subscriptions` sync paths were hardened.
- `stripe_webhook_events.processed_at` is updated.
- Netlify base64 raw body is handled before Stripe signature verification.
- `invoice.payment_succeeded` and `invoice.payment_failed` are handled.
- Only `active` and `trialing` count as supporter status.
- `past_due`, `canceled`, and `unpaid` do not count as supporter status.
- User-facing paid terminology is based on `サポーター` / `Supporter`.
- Donation remains separate from supporter registration and currently does not unlock features.

Recent commits already pushed before this handoff:
- `274bd8a Fix supporter Stripe billing sync recovery`
- `781d07a Fix privacy policy FF Logs data wording`

Do not commit anything to `main` unless the user explicitly asks.

## User Policy / Product Framing

Use these rules consistently:
- User-facing paid/support language should be `サポーター` / `Supporter`.
- Avoid user-facing `Pro`, `Premium`, `有料会員`, `paid member`, `subscription plan`, and `professional plan`.
- Internal names such as `isPremium`, `premium.html`, and `premium-preview.js` may remain for now unless explicitly refactoring.
- Do not frame supporter registration as selling access to FINAL FANTASY XIV assets or FF Logs API rights.
- Basic comparison should remain free enough to be useful.
- Donation should work by formal service launch, but detailed Donation planning is a medium-term item.
- Donation must remain optional and separate from supporter status.

## Next Session Working Rules

Use BrowserMCP for autonomous browser-assisted development when practical.

Expected flow:
1. Use BrowserMCP to inspect the live site or Netlify Preview in Chrome.
2. Identify UX issues from the actual page, not only from code.
3. Implement changes locally.
4. Run focused tests and syntax checks.
5. Commit to `final-qa`.
6. Push `final-qa`.
7. Trigger or wait for Netlify Preview.
8. Verify the Preview URL in browser.
9. Report the Preview URL and the verified scope.

If BrowserMCP cannot interact with a target tab, explain the limitation and continue with manual guidance plus local tests. Do not expose secrets in chat, shell output, commits, or files.

## Short-Term Roadmap For Final QA

The old `ROADMAP.md` can be ignored for planning purposes until the user explicitly asks to update it. It is a living document and currently behind the real implementation.

Short-term items to evaluate and implement:
- FF Logs API failure messages.
- Encounter mismatch behavior and copy.
- Navigation between tutorial, top page, and supporter pages.
- Error UI for failed loads, unsupported logs, no kill fights, player lookup failures, supporter-required actions, and Stripe portal failures.

The user is not asking to decide these blindly. In the next session, inspect the site with BrowserMCP and propose/implement concrete improvements based on the actual UI.

For error UI, aim to make clear:
- What happened.
- What the user should do next.
- Whether retrying makes sense.
- Whether another FF Logs URL is needed.
- Whether the issue is likely site-side and should be reported.

## Supporter Page / Supporter-Only Page Changes

The current supporter registration page is mostly useful for non-supporters. Supporters need a separate in-site area.

Implement or plan the following:

### Non-Supporter Registration Page

The current `premium.html` should become a non-supporter-facing registration and benefits page.

Changes requested:
- Remove the `サポーター登録を管理` button from the registration/benefits page.
- Keep the page focused on benefits, pricing, confirmation, and registration.
- Fix awkward line breaks in the supporter benefits description text.
- Add DPS graph / DPS wave visualization to supporter benefits.
- Adjust the supporter benefits promo image layout:
  - Move the `200円` price text to the top area of the image.
  - Keep it inside the frame.
  - Place it around the crystal shown in the promo image.

### Supporter-Only Page

Create a page intended for logged-in supporters.

Initial contents:
- Supporter status area.
- Link/button to open Stripe Customer Portal for supporter registration and billing management.
- A place for future supporter-only convenience features.

Potential future contents:
- Current registration status.
- Next renewal or paid period end.
- Cancellation scheduled state.
- Bookmark-related shortcuts.
- Usage status.

Keep the page useful for supporters without making the public registration page carry management UI.

## DPS Graph Supporter Gating

The DPS wave / DPS line graph is currently available to free users. The user wants to move this to supporter features.

Implement carefully:
- Gate the DPS line graph behind supporter status.
- Keep core timeline comparison usable for free users.
- Add a clear but restrained prompt where the graph would appear for non-supporters.
- Add the DPS graph item to supporter benefits copy.
- Make sure this is framed as site-side visualization/convenience, not FF Logs API access resale.

Related note:
- Debuff lane, synergy lane, party comparison, and basic timeline comparison should remain free.

## Medium-Term Roadmap

Prioritize maintainability and operating quality:
- Split `scripts/ui/timeline.js` by responsibility.
- Split `scripts/data/fflogs.js` by responsibility.
- Expand tests around comparison logic, FF Logs transforms, and error handling.
- Consider internal `premium` naming cleanup later, after user-facing functionality settles.
- Convert display lane ON/OFF controls to iOS-like toggles.
- Improve URL shareability without breaking the current selection restore behavior.

Post-formal-launch backlog only:
- Wipe fight support.
- SNS share / image export / share output.
- Analytics v2.

These are not immediate final-QA blockers. Keep them in mind only.

## Production Operations Items For Next Session

The user wants these handled in the next session:
- Regular Stripe production webhook check.
- Fix or document Netlify Function log checking flow.
- Fix or document the Supabase tables to inspect:
  - `billing_customers`
  - `billing_subscriptions`
  - `stripe_webhook_events`
- Confirm after 2026-06-01 that the canceled account is no longer treated as supporter.
- Continue secret handling discipline.
- Re-send or prepare a follow-up commercial-use permission email to FF Logs if requested.

Operational docs to create or update:
- Production payment verification procedure.
- Stripe webhook resend verification procedure.
- Supporter status troubleshooting procedure.
- Netlify environment variable safety notes.
- Refund, duplicate payment, and support inquiry memo.

## Browser QA Targets

Use BrowserMCP or a normal browser flow to check:
- `/`
- `/tutorial.html`
- `/premium.html`
- New supporter-only page if created.
- `/terms.html`
- `/privacy.html`
- `/commercial-transactions.html`

Check at least:
- Non-logged-in user path.
- Logged-in free user path.
- Supporter path if the session/account is available.
- Supporter-required feature prompt.
- Stripe Customer Portal button from supporter-only page.
- Links among top, tutorial, supporter registration, and legal pages.

## Verification Commands

Run focused checks as appropriate:

```powershell
npm test -- --run tests/page-assets.test.js tests/browser-module-syntax.test.js
node --check netlify/functions/create-checkout.js
node --check netlify/functions/create-portal-session.js
node --check netlify/functions/stripe-webhook.js
rg -n "\bPro\b|Premium|有料会員|paid member|subscription plan|professional plan" premium.html terms.html privacy.html commercial-transactions.html index.html tutorial.html scripts -S
rg -n "FF Logs API無制限|APIを叩く|FF14アセット.*解放|シナジー.*サポーター|デバフ.*サポーター|PT比較.*サポーター" . -S
```

Broaden to `npm test` if implementation touches shared comparison logic, billing logic, auth, or multiple pages.

## Current Worktree Notes

Before this handoff, unrelated untracked files existed:
- `.playwright-mcp/`
- `assets/Neuform/`
- `neuform-fullpage.png`
- `neuform-ui-check.png`

Do not remove or commit them unless the user explicitly asks.

## Completion Expectation For Next Session

The next session should not stop at discussion if the user asks to proceed. Implement the agreed final-QA changes, commit them on `final-qa`, push, provide a Netlify Preview URL, and verify the Preview URL.
