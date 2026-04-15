function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toJstDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const jstMs = date.getTime() + (9 * 60 * 60 * 1000);
  return new Date(jstMs).toISOString().slice(0, 10);
}

function buildDayKeys(days, now = new Date()) {
  const baseDate = now instanceof Date ? now : new Date(now);
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(baseDate.getTime() - (i * 24 * 60 * 60 * 1000));
    keys.push(toJstDateKey(date.toISOString()));
  }
  return keys;
}

function pickRecent(rows, eventType, limit = 8) {
  return rows
    .filter((row) => row.event_type === eventType)
    .slice(0, limit)
    .map((row) => ({
      createdAt: row.created_at,
      pathname: row.pathname || '/',
      details: row.details || {},
    }));
}

function countEntries(map, key) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return;
  map.set(normalizedKey, (map.get(normalizedKey) || 0) + 1);
}

function mapToSortedEntries(map, keyName, limit) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ [keyName]: key, count }));
}

function getErrorCauseLabel(details = {}) {
  const stage = String(details.stage || 'unknown').trim() || 'unknown';
  const reason = String(details.reason || details.kind || '').trim();
  return reason ? `${stage}:${reason}` : stage;
}

function summarizeEvents(rows, days, nowMs = Date.now()) {
  const windowStart = nowMs - (days * 24 * 60 * 60 * 1000);
  const windowRows = rows.filter((row) => {
    const ts = Date.parse(row.created_at);
    return Number.isFinite(ts) && ts >= windowStart;
  });

  const counts = {
    page_view: 0,
    reports_loaded: 0,
    comparison_completed: 0,
    api_error: 0,
  };

  const topJobs = new Map();
  const topPaths = new Map();
  const topErrorCauses = new Map();
  const sessionIds = new Set();
  const dayKeys = buildDayKeys(days, nowMs);
  const dailyMap = new Map(dayKeys.map((key) => [key, {
    label: key.slice(5),
    pageViews: 0,
    reportsLoaded: 0,
    comparisons: 0,
    errors: 0,
  }]));

  for (const row of windowRows) {
    const eventType = String(row.event_type || '');
    const details = row.details || {};
    if (eventType in counts) {
      counts[eventType] += 1;
    }

    countEntries(topPaths, String(row.pathname || '/'));

    const sessionId = String(details.sessionId || '').trim();
    if (sessionId) sessionIds.add(sessionId);

    if (eventType === 'comparison_completed') {
      for (const job of [details.jobA, details.jobB]) {
        countEntries(topJobs, job);
      }
    }

    if (eventType === 'api_error') {
      countEntries(topErrorCauses, getErrorCauseLabel(details));
    }

    const dayKey = toJstDateKey(row.created_at);
    const daily = dailyMap.get(dayKey);
    if (!daily) continue;
    if (eventType === 'page_view') daily.pageViews += 1;
    if (eventType === 'reports_loaded') daily.reportsLoaded += 1;
    if (eventType === 'comparison_completed') daily.comparisons += 1;
    if (eventType === 'api_error') daily.errors += 1;
  }

  const pageViews = counts.page_view;
  const reportsLoaded = counts.reports_loaded;
  const comparisons = counts.comparison_completed;

  return {
    windowDays: days,
    sampledEvents: rows.length,
    windowEvents: windowRows.length,
    totals: {
      sessions: sessionIds.size,
      pageViews,
      reportsLoaded,
      comparisons,
      apiErrors: counts.api_error,
      comparePerViewRate: pageViews > 0 ? Number((comparisons / pageViews).toFixed(3)) : 0,
      comparePerLoadRate: reportsLoaded > 0 ? Number((comparisons / reportsLoaded).toFixed(3)) : 0,
    },
    daily: dayKeys.map((key) => ({ date: key, ...dailyMap.get(key) })),
    topJobs: mapToSortedEntries(topJobs, 'job', 8),
    topPaths: mapToSortedEntries(topPaths, 'pathname', 6),
    topErrorCauses: mapToSortedEntries(topErrorCauses, 'label', 6),
    recentErrors: pickRecent(windowRows, 'api_error', 8),
    recentComparisons: pickRecent(windowRows, 'comparison_completed', 8),
    recentLoads: pickRecent(windowRows, 'reports_loaded', 8),
    lastEventAt: rows[0]?.created_at || null,
  };
}

module.exports = {
  buildDayKeys,
  clamp,
  getErrorCauseLabel,
  mapToSortedEntries,
  pickRecent,
  summarizeEvents,
  toJstDateKey,
};
