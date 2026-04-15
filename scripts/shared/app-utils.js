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

  return {
    computeRollingDps,
    parseFFLogsUrl,
  };
}));
