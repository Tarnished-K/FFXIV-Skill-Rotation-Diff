const { buildSharedStateQuery, computeRollingDps, parseFFLogsUrl, parseSharedState } = require('../scripts/shared/app-utils');

describe('parseFFLogsUrl', () => {
  it('extracts report ids from FFLogs report urls', () => {
    expect(parseFFLogsUrl('https://ja.fflogs.com/reports/8TP4ZKDkxbBwgmtC?fight=21&type=damage-done')).toEqual({
      reportId: '8TP4ZKDkxbBwgmtC',
      original: 'https://ja.fflogs.com/reports/8TP4ZKDkxbBwgmtC?fight=21&type=damage-done',
    });
  });

  it('returns null for invalid urls', () => {
    expect(parseFFLogsUrl('not-a-url')).toBeNull();
  });

  it('returns null when the path does not contain a report id', () => {
    expect(parseFFLogsUrl('https://ja.fflogs.com/zone/rankings/65')).toBeNull();
  });
});

describe('computeRollingDps', () => {
  it('returns an empty array when there are no events', () => {
    expect(computeRollingDps([], 5)).toEqual([]);
  });

  it('computes a rolling dps window across the full timeline', () => {
    const points = computeRollingDps([
      { t: 1, amount: 100 },
      { t: 4, amount: 50 },
      { t: 19, amount: 150 },
    ], 20, 10);

    expect(points[0]).toEqual({ t: 0, dps: 0 });
    expect(points[5]).toEqual({ t: 5, dps: 30 });
    expect(points[10]).toEqual({ t: 10, dps: 15 });
    expect(points[20]).toEqual({ t: 20, dps: 15 });
  });
});

describe('shareable state query helpers', () => {
  it('parses known query parameters into shareable state', () => {
    expect(parseSharedState('?ra=AAA&rb=BBB&fa=1&fb=2&pa=11&pb=22&tb=odd&z=1.5&l=ja')).toEqual({
      reportA: 'AAA',
      reportB: 'BBB',
      fightA: '1',
      fightB: '2',
      playerA: '11',
      playerB: '22',
      tab: 'odd',
      zoom: 1.5,
      lang: 'ja',
    });
  });

  it('builds a compact query string from partial state', () => {
    expect(buildSharedStateQuery({
      reportA: 'AAA',
      reportB: 'BBB',
      fightA: 1,
      playerB: 22,
      tab: 'even',
      zoom: 2.25,
      lang: 'en',
    })).toBe('?ra=AAA&rb=BBB&fa=1&pb=22&tb=even&z=2.25&l=en');
  });

  it('drops unsupported tab, zoom, and lang values', () => {
    expect(parseSharedState('?tb=bad&z=10&l=de')).toEqual({
      reportA: '',
      reportB: '',
      fightA: '',
      fightB: '',
      playerA: '',
      playerB: '',
      tab: '',
      zoom: null,
      lang: '',
    });
  });
});
