# Script Layout

## Directories

- `app/`
  Holds app runtime state and startup wiring.
- `data/`
  Holds FF Logs auth and data-fetch helpers.
- `ui/`
  Holds timeline shaping and rendering.

## Load Order

- `app/runtime.js`
  Shared constants, app state, DOM lookups, and debug helpers.
- `data/fflogs.js`
  FF Logs auth, API access, icon lookup, and report or player data helpers.
- `ui/timeline.js`
  Timeline shaping, damage correlation, phase detection, and rendering.
- `app/bootstrap.js`
  UI event wiring, language application, and bootstrap logic.

`../script.js` remains a lightweight loader and preserves this order.
