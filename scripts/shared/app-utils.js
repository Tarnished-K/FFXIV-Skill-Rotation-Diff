(function attachAppSharedUtils(root, factory) {
  const exports = factory();
  root.AppSharedUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAppSharedUtils() {
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
    const points = [];
    for (let t = 0; t <= maxT; t += 1) {
      const windowStart = Math.max(0, t - windowSec);
      let totalDamage = 0;
      for (const event of damageEvents) {
        if (event.t >= windowStart && event.t < t) totalDamage += event.amount;
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

  return {
    buildSharedStateQuery,
    computeRollingDps,
    parseFFLogsUrl,
    parseSharedState,
  };
}));
