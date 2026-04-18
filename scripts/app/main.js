// Application entry point — side-effect imports only.
// Each module still uses globalThis.* for cross-module sharing.
// Export/import wiring is deferred to later ESM migration PRs.
import './runtime.js';
import './tutorial.js';
import '../shared/app-utils.js';
import '../shared/encounter-utils.js';
import '../shared/player-utils.js';
import '../shared/selection-utils.js';
import '../shared/buff-utils.js';
import '../shared/phase-utils.js';
import '../shared/timeline-utils.js';
import '../data/fflogs.js';
import '../ui/timeline.js';
import './bootstrap.js';
