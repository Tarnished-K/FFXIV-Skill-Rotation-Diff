# Handoff

Updated: 2026-04-18

## Branches and deploys

- Active branch: `feature/feedback-intake`
- Latest pushed commit: `61c8d70` (`Add feedback intake admin workflow`)
- Branch pushed to: `origin/feature/feedback-intake`
- `main` has not been pushed or modified in this handoff step

Preview built from the committed branch snapshot:

- Preview root: `https://69e2650f70810718f6db35d7--vermillion-crumble-a1f1aa.netlify.app`
- Feedback admin: `https://69e2650f70810718f6db35d7--vermillion-crumble-a1f1aa.netlify.app/feedback-admin.html`
- Analytics: `https://69e2650f70810718f6db35d7--vermillion-crumble-a1f1aa.netlify.app/analytics.html`
- Build info: `https://69e2650f70810718f6db35d7--vermillion-crumble-a1f1aa.netlify.app/api/build-info`

## What is implemented

- Feedback intake flow with Netlify Functions + Supabase persistence
- Gemini moderation for `general` / `trash`
- Japanese-first moderation improvements
  - explicit Japanese abuse phrases are rule-blocked to `trash`
  - Gemini prompt strengthened for short Japanese abuse
- Public feedback page
  - no admin link exposed
  - no "AI will sort this" wording exposed
- Feedback admin page
  - unread-first listing
  - mark read
  - move to trash
  - restore
  - purge expired
- Analytics page
  - dashboard UI still present
  - now protected behind the same admin auth flow
- Supabase Auth-based admin gate
  - login form on `feedback-admin.html`
  - login form on `analytics.html`
  - server-side bearer token verification in admin and analytics functions
  - allowlist via `ADMIN_EMAILS`
- Runtime env helper for Netlify/server compatibility
- Tests for feedback, moderation, admin auth, analytics auth, and build info

## Key files

- `contact.html`
- `feedback-admin.html`
- `analytics.html`
- `lib/admin-auth.js`
- `lib/feedback-db.js`
- `lib/feedback-moderation.js`
- `lib/runtime-env.js`
- `netlify/functions/admin-session.js`
- `netlify/functions/public-config.js`
- `netlify/functions/feedback-submit.js`
- `netlify/functions/feedback-admin-list.js`
- `netlify/functions/feedback-admin-mark-read.js`
- `netlify/functions/feedback-admin-move-to-trash.js`
- `netlify/functions/feedback-admin-restore.js`
- `netlify/functions/feedback-admin-purge.js`
- `netlify/functions/analytics-summary.js`
- `scripts/shared/admin-auth.js`
- `scripts/shared/feedback-admin.js`
- `scripts/shared/analytics-dashboard.js`

## Current env and external setup status

Confirmed on Netlify:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `SUPABASE_ANON_KEY`
- `ADMIN_EMAILS`

Likely still required or at least not confirmed complete:

- Supabase Auth admin user creation for the exact email in `ADMIN_EMAILS`
- The user must be able to sign in with email/password and have confirmed email status

## What still needs to be done

1. Create or confirm the Supabase Auth admin user
   - Supabase Dashboard -> `Authentication` -> `Users`
   - user email must exactly match `ADMIN_EMAILS`
   - set or confirm password
   - confirm email if required

2. Verify admin login end-to-end on the preview
   - open the preview admin page
   - confirm the login form appears
   - sign in successfully
   - verify list data loads

3. Verify analytics login end-to-end on the preview
   - open the preview analytics page
   - confirm the login form appears
   - sign in successfully
   - verify summary data loads

4. If preview verification succeeds, decide the release path
   - keep branch as-is
   - create PR
   - or merge later

## Fresh verification already run

- `npm test`
  - result: `21 passed files / 87 passed tests`
- `curl` checks against preview
  - `feedback-admin.html` -> `200`
  - `analytics.html` -> `200`
- deployed HTML confirmed to include login forms on both protected pages
- preview `build-info` returned version `1.0.21`

## Notes for Claude

- There are two intentionally uncommitted local files:
  - `ROADMAP.md`
  - `deno.lock`
- They were left out of the feature commit on purpose.
- A local export folder was created only to make a draft deploy from the committed snapshot:
  - `.preview-export/`
- `.preview-export/` is now ignored and should not be committed.
- The preview above is a manual Netlify draft deploy from the committed branch snapshot, not proof that `main` changed.
- If another preview is needed, deploy from `feature/feedback-intake` or from the current commit, not from local dirty files.
