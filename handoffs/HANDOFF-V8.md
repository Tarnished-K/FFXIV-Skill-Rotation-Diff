# HANDOFF-V8

## Current Branch

- Active branch: `feature/sidebar-premium-shell-i18n`
- Do not commit or push directly to `main`.
- Continue future work on a feature/hotfix branch separate from `main`.

## Latest Session Summary

This session continued UI and preview work on `feature/sidebar-premium-shell-i18n`.

Completed changes:

- Added a supporter registration sidebar tab below the login tab.
  - Uses `assets/UI asset/sap.png`.
  - Localized label support was added through `scripts/shared/site-shell.js`.
- Replaced the top header text block with `assets/UI asset/site top.png`.
  - Removed visible header text:
    - `XIV Skill Rotation Diff`
    - `FFLogs の公開ログ URL 2 件からスキル回しを比較します`
- Moved `support.png` usage to the monthly price panel background on the supporter registration page.
  - Removed `support.png` from the `Supporter unlocks analysis lanes` feature focus window.
- Added CSS-only crystal loading animation.
  - Uses `assets/UI asset/crystal.png` and `assets/UI asset/line.png`.
  - Implemented scoped classes:
    - `.crystal-loader`
    - `.magic-circle`
    - `.loader-crystal`
    - `.crystal-loader-text`
    - `.loading-overlay`
    - `.is-hidden`
  - Includes `prefers-reduced-motion: reduce` handling.
- Brightened the sidebar divider image treatment for the `image18` visual.

## Latest Commit

- `d662222 feat: add supporter nav and crystal loader`

Pushed to:

- `origin/feature/sidebar-premium-shell-i18n`

## Latest Netlify Preview

Draft preview URL:

- `https://69f1a77c3b189702f7fb5bea--vermillion-crumble-a1f1aa.netlify.app`

Build/deploy notes:

- Deployed with `netlify.cmd deploy --build`.
- Netlify site: `vermillion-crumble-a1f1aa`.

## Verification Completed

Automated/local checks:

- `npm.cmd test`
  - Passed: 115 tests.
- `git diff --check`
  - Passed, only CRLF warnings.

Preview checks:

- Home page loads `site top.png`.
- Sidebar supporter tab appears and uses `sap.png`.
- Crystal loader exists and uses:
  - `line.png`
  - `crystal.png`
- Supporter page sidebar marks supporter tab active.
- Supporter price panel uses `support.png` as background.
- `support.png` is no longer inside the `Supporter unlocks analysis lanes` window.
- FFLogs proxy POST was verified against report `nx7VrZcbt4qjfNzD`.
  - Response status: `200`.

## Required Future Workflow

For all future work:

1. Never commit or push directly to `main`.
2. Always use a dedicated branch separate from `main`.
3. Commit and push completed work to that dedicated branch.
4. Before reporting completion, verify that relevant features work.
   - UI changes should be checked in-browser when practical.
   - FFLogs loading/proxy behavior should be checked when the change may affect log loading.
   - Tests should be run when available and relevant.
5. Provide a working Netlify preview URL in the completion report.
   - The preview should be deployed from the branch containing the completed work.
   - Report known limitations clearly if any feature cannot be verified.

## Notes For Next Session

- User accepted the latest implementation as mostly matching the request, with possible minor improvements remaining.
- Continue from `feature/sidebar-premium-shell-i18n` unless the user asks to create a new branch.
- If new work begins, inspect current branch status first and pull/rebase from origin if needed.
