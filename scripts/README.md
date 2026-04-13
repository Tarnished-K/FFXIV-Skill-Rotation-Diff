# Script Layout

- `core.js`
  Holds shared constants, app state, DOM element lookups, and debug helpers.
- `fflogs-data.js`
  Holds FFLogs auth/API access, icon lookup, and report or player data helpers.
- `timeline.js`
  Holds timeline shaping, damage correlation, phase detection, and rendering.
- `app-init.js`
  Holds UI event wiring, language application, and bootstrap logic.

`../script.js` is now only a lightweight loader that preserves script order.
