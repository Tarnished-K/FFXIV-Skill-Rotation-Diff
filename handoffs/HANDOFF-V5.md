# HANDOFF V5

## Current State

- Branch: `feature/supporter-bookmarks-synergy-tl`
- Remote: `origin/feature/supporter-bookmarks-synergy-tl`
- Current HEAD: `81cbdb8 feat: add supporter timeline lane controls`
- Working tree at handoff creation: clean before this handoff file was added
- Latest manual Netlify preview confirmed `200 OK`:
  - `https://69ec0c48bd5d657338c1e016--vermillion-crumble-a1f1aa.netlify.app`
  - Deploy log: `https://app.netlify.com/projects/vermillion-crumble-a1f1aa/deploys/69ec0c48bd5d657338c1e016`
- Validation before handoff:
  - `npm test`
  - Result: 48 test files passed, 202 tests passed

## Completed In The Current Branch

Supporter timeline feature work has been implemented and pushed.

- Added supporter-only timeline lane controls:
  - Synergy TL
  - Weakness / Damage Down TL
  - Boss Cast TL
- Boss cast timeline now:
  - Uses FFLogs enemy cast data
  - Splits boss/add casts correctly using `actor.type` and `actor.subType`
  - Fetches Japanese Action names from XIVAPI v2 when available
  - Falls back to FFLogs English names
  - Is supporter-only
  - Appears in player comparison and party comparison
- Party comparison remains supporter-only.
- Non-supporters touching supporter-only controls are redirected to `/premium.html`.
- Bookmark save/list now redirect non-supporters to `/premium.html?feature=bookmarks`.
- Header status now includes a registration link for free users.
- Usage limits changed:
  - Anonymous/non-member: 3 comparisons per day
  - Logged-in free user: 10 comparisons per day
  - Supporter: unlimited
- Supporter checkout button is disabled and shows `準備中`.
- URL restore locks load/compare/select controls while restoring.
- Odd/even TL filter now focuses the target minute +/- 7 seconds.
- Player name tags were moved above the Ability rail label and constrained left of the 0-second start line.

## Next User Request To Implement

The next work should make the supporter page more compelling.

Original user request to carry forward:

> そしたらサポーター向けのページをもう少し豪華にしよう。シナジーTL・デバフTL・ボス詠唱のTLの3種のTL分析へのアクセス、ブックマークの登録がまだ記載されてないかな？あと実際にどんな画面になるのかを見せたいから、https://ja.fflogs.com/reports/nx7VrZcbt4qjfNzD?fight=308&type=damage-done　このリンクから実際に読み取ろう。実際の比較結果のUIをそのままサポーター画面のところにも表示しよう。ただサポーター登録画面はこのURLで固定ね。

Interpretation / implementation target:

- Update `premium.html` so the supporter page clearly advertises:
  - Access to Synergy TL analysis
  - Access to Weakness / Damage Down TL analysis
  - Access to Boss Cast TL analysis
  - Bookmark registration/listing
  - Existing supporter benefits such as ad hiding, higher/unlimited usage, etc.
- Add a richer preview of the actual comparison result UI to `premium.html`.
- Use this FFLogs URL as the fixed sample source for the supporter page preview:
  - `https://ja.fflogs.com/reports/nx7VrZcbt4qjfNzD?fight=308&type=damage-done`
- The supporter page itself should remain the fixed destination URL:
  - `/premium.html`
  - Feature redirects may keep query params, e.g. `/premium.html?feature=party-timeline`, but do not send users to another checkout URL yet.
- Registration remains not live:
  - Keep the button disabled / `準備中`
  - This is intentional: the user wants to signal that supporter registration is being prepared.

## Suggested Approach For Premium Page Preview

Do not require a live user comparison workflow inside `premium.html` unless it is simple and safe.

Recommended pragmatic approach:

1. Read the fixed FFLogs report via existing proxy/API helpers or a small page-local fetch path.
2. Use a deterministic sample fight/player pairing from the report to generate a representative timeline preview.
3. Prefer reusing the current timeline renderer styles/classes so the preview resembles the real app.
4. If fully reusing `renderTimeline()` is too coupled to app state, create a compact static preview using the same visual classes:
   - DPS graph band
   - Synergy lane
   - Weakness / Damage Down lane
   - Boss Cast lane
   - Ability / WS rail with a few sample events
5. The preview should be visually convincing, not a separate marketing illustration.

Important: the user specifically asked to read from the real FFLogs link. If a static fallback is used, document why and keep the fixed report link in the page/source comments.

## Likely Files For Next Work

- `premium.html`
- `styles.css`
- `styles-base.css`
- `styles-timeline.css`
- Possibly `scripts/app/runtime.js` for copy strings
- Possibly a new `scripts/premium-preview.js` if the preview logic becomes non-trivial
- Possibly tests if adding shared logic

## ABC Priority Work Still Not Done

The user mentioned that "ABC priority work items" are probably still unfinished. There is no literal `ABC` section found in the repo, but `ROADMAP.md` still lists the closest high-priority backlog. Treat these as still open unless the user says otherwise:

### A. Production Stability

From `ROADMAP.md` "最優先 / 1. 本番安定化":

- Keep public FFLogs load -> fight select -> player select -> compare flow stable on production.
- Clean up failure UI for FFLogs/API/render errors.
- Avoid confusing sample-data fallback behavior.
- Align encounter mismatch behavior with the desired UX.

### B. Testability / Minimal Extraction

From `ROADMAP.md` "最優先 / 2. テスト可能化のための最小抽出":

- Remove or reduce `state`/DOM/logDebug dependencies from logic functions.
- Extract phase, DPS, analytics, proxy error, and similar pure logic into testable modules.

### C. Minimal Test Coverage

From `ROADMAP.md` "最優先 / 3. テストの最小導入":

- Continue adding Vitest coverage for:
  - FFLogs URL parsing
  - Phase composition
  - DPS aggregation
  - Analytics aggregation
  - Error message normalization
  - Core comparison regression behavior

These are not part of the supporter page request unless the implementation touches the same areas. Keep them noted for future work.

## Cautions

- Do not push to `main`.
- Current feature branch has already been pushed; continue on `feature/supporter-bookmarks-synergy-tl` unless the user requests a new branch.
- Do not re-enable live checkout yet. The premium page button should stay as `準備中`.
- If using browser fetch to XIVAPI/FFLogs from `premium.html`, confirm CORS and failure behavior.
- Netlify branch alias often takes time to resolve. Use deploy-id fixed URLs for immediate preview confirmation.
- Run `npm test` before handing back.

