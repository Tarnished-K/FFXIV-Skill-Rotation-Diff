# Handoff V4

## Current State

- Branch: `feature/supporter-bookmarks-synergy-tl`
- Latest commit: `be053e0 feat: add party timeline boss and debuff lanes`
- Remote branch: `origin/feature/supporter-bookmarks-synergy-tl`
- Latest preview: `https://69eba82d8f1a2232a7877e15--vermillion-crumble-a1f1aa.netlify.app`

## Completed

- PT comparison was turned into a supporter-only feature gate.
- The PT comparison filter UI was added and moved into the dedicated custom modal.
- Loading and compare actions are blocked during comparison startup, which prevents the null-name compare failure.
- The PT timeline now shows boss cast lanes and player debuff lanes.
- FFLogs fetching was fixed so boss casts use enemy hostility and debuffs are collected without the failing `targetID` filter.
- The compare flow and timeline rendering tests were updated and `npm test` passed.
- The branch was pushed successfully to the dedicated remote branch.

## Incomplete

- Boss cast lanes are still too dense when many enemies cast at once.
- That density issue is intentionally left for a separate pass.

## Next Planned Work

- Apply the separate boss cast density improvement that was identified after this change.
- Keep the boss cast presentation scoped as a follow-up rather than widening the current fix.
- If the next pass needs more cleanup, review whether boss cast aggregation should be compressed or visually grouped before touching the rest of the timeline.

## Notes

- `HANDOFF.md`, `HANDOFF-V2.md`, and `HANDOFF-V3.md` now live under `handoffs/`.
- Root `HANDOFF.md` is now only an index into this folder.
