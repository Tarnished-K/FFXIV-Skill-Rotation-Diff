(function attachAppSharedUtils(root, factory) {
  const exports = factory();
  root.AppSharedUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAppSharedUtils() {
  const DEFAULT_TIMELINE_ZOOM = 2.5;

  function parseFFLogsUrl(raw) {
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/reports\/([A-Za-z0-9]+)/);
      if (!match) return null;
      return { reportId: match[1], original: raw };
    } catch {
      return null;
    }
  }

  function computeRollingDps(damageEvents, maxT, windowSec = 15) {
    if (!damageEvents || !damageEvents.length) return [];
    const events = [...damageEvents]
      .map((event) => ({
        t: Number(event?.t || 0),
        amount: Number(event?.amount || 0),
      }))
      .filter((event) => Number.isFinite(event.t) && Number.isFinite(event.amount))
      .sort((a, b) => a.t - b.t);
    const points = [];
    let totalDamage = 0;
    let addIndex = 0;
    let removeIndex = 0;
    for (let t = 0; t <= maxT; t += 1) {
      const windowStart = Math.max(0, t - windowSec);
      while (addIndex < events.length && events[addIndex].t < t) {
        totalDamage += events[addIndex].amount;
        addIndex += 1;
      }
      while (removeIndex < addIndex && events[removeIndex].t < windowStart) {
        totalDamage -= events[removeIndex].amount;
        removeIndex += 1;
      }
      const elapsed = Math.min(t, windowSec);
      points.push({ t, dps: elapsed > 0 ? totalDamage / elapsed : 0 });
    }
    return points;
  }

  function parseSharedState(search = '') {
    const raw = String(search || '');
    const params = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`);
    const tab = String(params.get('tb') || '').trim();
    const zoom = Number(params.get('z') || '');
    const lang = String(params.get('l') || '').trim();
    return {
      reportA: String(params.get('ra') || '').trim(),
      reportB: String(params.get('rb') || '').trim(),
      fightA: String(params.get('fa') || '').trim(),
      fightB: String(params.get('fb') || '').trim(),
      playerA: String(params.get('pa') || '').trim(),
      playerB: String(params.get('pb') || '').trim(),
      phase: String(params.get('ph') || '').trim(),
      tab: ['all', 'odd', 'even'].includes(tab) ? tab : '',
      zoom: Number.isFinite(zoom) && zoom >= 0.5 && zoom <= 3 ? zoom : null,
      lang: ['ja', 'en'].includes(lang) ? lang : '',
    };
  }

  function buildSharedStateQuery(sharedState = {}) {
    const params = new URLSearchParams();
    const entries = [
      ['ra', sharedState.reportA],
      ['rb', sharedState.reportB],
      ['fa', sharedState.fightA],
      ['fb', sharedState.fightB],
      ['pa', sharedState.playerA],
      ['pb', sharedState.playerB],
      ['ph', sharedState.phase],
      ['tb', sharedState.tab],
      ['z', sharedState.zoom],
      ['l', sharedState.lang],
    ];
    for (const [key, value] of entries) {
      if (value === null || value === undefined || value === '') continue;
      params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function formatZoomPercent(zoom, baseline = DEFAULT_TIMELINE_ZOOM) {
    const numericZoom = Number(zoom);
    const numericBaseline = Number(baseline);
    if (!Number.isFinite(numericZoom) || !Number.isFinite(numericBaseline) || numericBaseline <= 0) {
      return '100%';
    }
    return `${Math.round((numericZoom / numericBaseline) * 100)}%`;
  }

  return {
    buildSharedStateQuery,
    computeRollingDps,
    DEFAULT_TIMELINE_ZOOM,
    formatZoomPercent,
    parseFFLogsUrl,
    parseSharedState,
  };
}));
