# HANDOFF V7

## Current State

- Repository: `FFXIV-Skill-Rotation-Diff`
- Main branch policy: `main` commit/push was not touched.
- Working branch: `feature/fflogs-ranking-links-20260429`
- Local HEAD at handoff creation: `507c80b Tune UI assets and timeline hover`
- Previous session commit: `144586f Improve ranking links and header UI`
- Remote branch note: `origin/feature/fflogs-ranking-links-20260429` has one newer commit not in local at handoff time:
  - `cfd7de4 Add files via upload`
  - Adds `assets/UI asset/image999.png`
  - This was not created by this session and was not merged locally before writing this handoff.
- Netlify draft preview from latest local committed work:
  - `https://69f0e27ea568a98574b6a367--vermillion-crumble-a1f1aa.netlify.app`
- Working tree at handoff creation:
  - Tracked work is committed locally at `507c80b`.
  - Existing untracked files remain untouched:
    - `.playwright-mcp/`
    - `assets/Neuform/`
    - `neuform-fullpage.png`
    - `neuform-ui-check.png`

## Completed In This Session

UI improvement work for the main comparison page.

### Ranking Links

- Added FFLogs links to the left sidebar ranking menu.
- Damage ranking links use the requested `metric=dps` / `dpstype=rdps` variants where provided.
- Speed ranking links use the requested speed URLs.
- Ranking links open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.

### Header And Sidebar Cleanup

- Header title changed from `FFXIV Skill Codex` / `FFXIV Skill Rotation Diff` display to `XIV Skill Rotation Diff`.
- Removed header request form link and header auth UI from the visible topbar.
- Sidebar login/logout remains the auth entry point.
- Removed the old API limit block from the sidebar because the remaining usage has its own section.
- Increased sidebar ranking width/spacing and allowed ranking names to wrap so names are not clipped.
- Increased sidebar metadata label/value font sizes:
  - `ユーザー名`
  - `会員ステータス`
  - `本日の残り回数`

### Step Cards And Timeline Layout

- Increased step 1-3 heading and helper text size slightly.
- Matched `4. 比較結果` heading size to step 1-3 headings.
- Aligned the visible heights of step 1, 2, and 3 cards.
- Aligned the bottom position of the step 1 load button with step 2/3 buttons.
- Slightly reduced the vertical gap between upper and lower timeline tracks.
- Replaced the zoom label text with a magnifying glass symbol.

### `image (27)` Reversal

- The previously requested `image (27)` divider treatment was reverted.
- Header/sidebar no longer use `assets/UI asset/image (27).png`.

### Initial Visual Asset Performance

- Added WebP versions of initial UI assets under `assets/ui/`.
- Updated HTML/CSS references for initial visual UI assets to use WebP:
  - background
  - crystal emblem
  - crystal sword
  - card window backgrounds
  - step 4 panel
  - button backgrounds
  - main sidebar nav icons
  - corner assets
- Added preload hints for the most important first-viewport images:
  - `bg-hero.webp`
  - `crystal-emblem.webp`
  - `card-window-bg.webp`
  - `card-window-warm.webp`
  - `btn-blue-dark.webp`
- Job action icons were intentionally left alone; slower loading there is acceptable per request.
- Current WebP total added size: about 1.3 MB for 19 files, replacing several much larger PNG loads in the critical UI path.

### DPS Graph Hover

- Fixed the issue where graph hover stayed in timeline drag/scroll mode.
- Main DPS graph SVGs now use `pointer-events:auto`.
- Added larger invisible hover circles around graph points.
- Added thick invisible hover line segments along DPS graph lines.
- Hover tooltips show time and DPS for the nearest point/segment.
- Applied to both personal timeline graph renderers and PT comparison graph rendering paths.

### Mothercrystal Status

- The Mothercrystal progress bar no longer jumps to 50/80 before comparison.
- It starts when `比較を開始` is clicked.
- It updates progressively as comparison API requests finish:
  - usage check
  - timeline A/B
  - damage A/B
  - healing A/B
  - buffs A/B
  - boss casts A/B
  - debuffs A/B
- Successful comparison sets `100% / COMPLETE`.
- Failed comparison sets `0% / ERROR`.
- Daily limit failure sets `0% / LIMIT`.
- `SYSTEM ONLINE` is shown when usage is available.
- `SYSTEM OFFLINE` is shown in red when the usage status indicates non-premium remaining usage is `0`.
- The status text size was increased.

### Background Visibility

- Reduced the dark overlay on the main background so the background image is more visible.

## Verification

- Unit tests:
  - `npm test`
  - Result: 48 test files passed, 202 tests passed.
- Diff whitespace:
  - `git diff --check`
  - Result: no errors, only expected Windows line-ending warnings.
- Browser verification:
  - Served locally with `python -m http.server 4174 --bind 127.0.0.1`.
  - Verified with Playwright via globally installed Playwright module.
  - Confirmed:
    - `XIV Skill Rotation Diff` visible.
    - WebP assets used in initial UI path.
    - preload tags present.
    - `image (27)` treatment removed.
    - step 1/2/3 heights match.
    - step 1/2/3 button bottoms align.
    - `4. 比較結果` heading matches 16px step heading size.
    - sidebar labels/user values enlarged.
    - Mothercrystal starts online and status text is larger.
    - background overlay is lighter.
- Netlify deploy:
  - Created draft deploy from a temporary local clone of the branch at `507c80b`.
  - Preview URL:
    - `https://69f0e27ea568a98574b6a367--vermillion-crumble-a1f1aa.netlify.app`
  - Verified preview returns HTTP 200 and contains WebP references and the updated title.

## Files Changed By This Session

- `index.html`
- `styles-redesign.css`
- `styles-neuform.css`
- `scripts/app/runtime.js`
- `scripts/app/bootstrap.js`
- `scripts/auth/auth-ui.js`
- `scripts/ui/timeline-render-core.js`
- `scripts/ui/timeline.js`
- New WebP assets in `assets/ui/`:
  - `bg-hero.webp`
  - `btn-blue-bright.webp`
  - `btn-blue-dark.webp`
  - `card-window-bg.webp`
  - `card-window-warm.webp`
  - `corner-bl.webp`
  - `corner-br.webp`
  - `corner-tl.webp`
  - `corner-tr.webp`
  - `crystal-emblem.webp`
  - `crystal-sword.webp`
  - `icon-compare.webp`
  - `icon-guide.webp`
  - `icon-home.webp`
  - `icon-lang-switch.webp`
  - `icon-load.webp`
  - `icon-login-new.webp`
  - `icon-request.webp`
  - `panel-step4.webp`

## Important Next Steps

1. Before continuing work on `feature/fflogs-ranking-links-20260429`, inspect and integrate the remote-only commit:
   - `cfd7de4 Add files via upload`
   - `assets/UI asset/image999.png`
   - Suggested command:
     - `git pull --rebase origin feature/fflogs-ranking-links-20260429`
   - This should be low risk because it adds a separate asset file, but it was not created by this session.
2. If the user reports DPS hover still feels hard to hit, consider replacing native SVG `<title>` tooltips with a custom positioned tooltip controlled by `mousemove`, because native title display delay differs by browser.
3. If initial load still feels slow, next optimization should be:
   - Replace remaining decorative CSS PNGs still referenced in lower-priority selectors, or
   - Remove heavy decorative images from first viewport entirely, or
   - Generate smaller fixed-dimension versions instead of only format conversion.
4. Do not merge to `main` without explicit permission.

