const { buildDayKeys, summarizeEvents, toJstDateKey } = require('../lib/analytics-utils');

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
        event_type: 'comparison_completed',
        pathname: '/',
        details: { jobA: 'BLM', jobB: 'PCT' },
        created_at: '2026-04-15T02:00:00.000Z',
      },
      {
        event_type: 'reports_loaded',
        pathname: '/',
        details: {},
        created_at: '2026-04-15T01:00:00.000Z',
      },
      {
        event_type: 'page_view',
        pathname: '/',
        details: {},
        created_at: '2026-04-15T00:00:00.000Z',
      },
      {
        event_type: 'api_error',
        pathname: '/analytics.html',
        details: { stage: 'compare' },
        created_at: '2026-04-14T03:00:00.000Z',
      },
      {
        event_type: 'page_view',
        pathname: '/',
        details: {},
        created_at: '2026-04-10T00:00:00.000Z',
      },
    ];

    const summary = summarizeEvents(rows, 2, Date.parse('2026-04-15T12:00:00.000Z'));

    expect(summary.windowEvents).toBe(4);
    expect(summary.totals).toEqual({
      pageViews: 1,
      reportsLoaded: 1,
      comparisons: 1,
      apiErrors: 1,
      comparePerViewRate: 1,
      comparePerLoadRate: 1,
    });
    expect(summary.daily).toEqual([
      {
        date: '2026-04-14',
        label: '04-14',
        pageViews: 0,
        reportsLoaded: 0,
        comparisons: 0,
        errors: 1,
      },
      {
        date: '2026-04-15',
        label: '04-15',
        pageViews: 1,
        reportsLoaded: 1,
        comparisons: 1,
        errors: 0,
      },
    ]);
    expect(summary.topJobs).toEqual([
      { job: 'BLM', count: 1 },
      { job: 'PCT', count: 1 },
    ]);
    expect(summary.topPaths).toEqual([
      { pathname: '/', count: 3 },
      { pathname: '/analytics.html', count: 1 },
    ]);
    expect(summary.recentErrors).toHaveLength(1);
  });
});
