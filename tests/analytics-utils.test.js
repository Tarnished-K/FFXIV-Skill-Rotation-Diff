const { buildDayKeys, getErrorCauseLabel, summarizeEvents, toJstDateKey } = require('../lib/analytics-utils');

describe('toJstDateKey', () => {
  it('converts timestamps into JST day keys', () => {
    expect(toJstDateKey('2026-04-14T18:30:00.000Z')).toBe('2026-04-15');
  });
});

describe('buildDayKeys', () => {
  it('builds an ordered list of JST day keys ending at the provided date', () => {
    expect(buildDayKeys(3, '2026-04-15T12:00:00.000Z')).toEqual([
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
    ]);
  });
});

describe('summarizeEvents', () => {
  it('summarizes recent analytics rows into totals, daily stats, and top jobs', () => {
    const rows = [
      {
        event_type: 'supporter_cta_clicked',
        pathname: '/',
        details: { sessionId: 'sess-1', source: 'sidebar' },
        created_at: '2026-04-15T03:00:00.000Z',
      },
      {
        event_type: 'comparison_completed',
        pathname: '/',
        details: { jobA: 'BLM', jobB: 'PCT', sessionId: 'sess-1' },
        created_at: '2026-04-15T02:00:00.000Z',
      },
      {
        event_type: 'reports_loaded',
        pathname: '/',
        details: { sessionId: 'sess-1' },
        created_at: '2026-04-15T01:00:00.000Z',
      },
      {
        event_type: 'page_view',
        pathname: '/',
        details: { sessionId: 'sess-1' },
        created_at: '2026-04-15T00:00:00.000Z',
      },
      {
        event_type: 'api_error',
        pathname: '/analytics.html',
        details: { stage: 'compare', reason: 'encounter_mismatch', sessionId: 'sess-2' },
        created_at: '2026-04-14T03:00:00.000Z',
      },
      {
        event_type: 'page_view',
        pathname: '/',
        details: { sessionId: 'sess-3' },
        created_at: '2026-04-10T00:00:00.000Z',
      },
    ];

    const summary = summarizeEvents(rows, 2, Date.parse('2026-04-15T12:00:00.000Z'));

    expect(summary.windowEvents).toBe(5);
    expect(summary.totals).toEqual({
      sessions: 2,
      pageViews: 1,
      reportsLoaded: 1,
      comparisons: 1,
      apiErrors: 1,
      supporterCtaClicks: 1,
      comparePerViewRate: 1,
      comparePerLoadRate: 1,
      errorPerViewRate: 1,
      errorPerLoadRate: 1,
      supporterCtaClickRate: 1,
    });
    expect(summary.daily).toEqual([
      {
        date: '2026-04-14',
        label: '04-14',
        pageViews: 0,
        reportsLoaded: 0,
        comparisons: 0,
        errors: 1,
        supporterClicks: 0,
      },
      {
        date: '2026-04-15',
        label: '04-15',
        pageViews: 1,
        reportsLoaded: 1,
        comparisons: 1,
        errors: 0,
        supporterClicks: 1,
      },
    ]);
    expect(summary.topJobs).toEqual([
      { job: 'BLM', count: 1 },
      { job: 'PCT', count: 1 },
    ]);
    expect(summary.topPaths).toEqual([
      { pathname: '/', count: 4 },
      { pathname: '/analytics.html', count: 1 },
    ]);
    expect(summary.topErrorCauses).toEqual([
      { label: 'compare:encounter_mismatch', count: 1 },
    ]);
    expect(summary.recentErrors).toHaveLength(1);
    expect(summary.recentLoads).toHaveLength(1);
  });
});

describe('getErrorCauseLabel', () => {
  it('prefers reason, then kind, and falls back to stage', () => {
    expect(getErrorCauseLabel({ stage: 'compare', reason: 'encounter_mismatch' })).toBe('compare:encounter_mismatch');
    expect(getErrorCauseLabel({ stage: 'compare', kind: 'validation' })).toBe('compare:validation');
    expect(getErrorCauseLabel({ stage: 'render' })).toBe('render');
  });
});
