const {
  buildRuler,
  classifyStats,
  deduplicateTimeline,
  filterTimeline,
  findEnemyActors,
  formatHitType,
  formatTimelineTime,
} = require('../scripts/shared/timeline-utils');

describe('filterTimeline', () => {
  const records = [{ t: 10 }, { t: 70 }, { t: 130 }];

  it('returns all records for the all tab', () => {
    expect(filterTimeline(records, 'all')).toEqual(records);
  });

  it('filters to odd minutes', () => {
    expect(filterTimeline(records, 'odd')).toEqual([{ t: 70 }]);
  });

  it('filters to even minutes after the first minute', () => {
    expect(filterTimeline(records, 'even')).toEqual([{ t: 130 }]);
  });
});

describe('buildRuler', () => {
  it('renders labeled tick marks every five seconds', () => {
    const ruler = buildRuler(10, 5);
    expect(ruler).toContain('<div class="tick ten" style="left:60px"><span>0s</span></div>');
    expect(ruler).toContain('<div class="tick five" style="left:85px"><span>5s</span></div>');
    expect(ruler).toContain('<div class="tick ten" style="left:110px"><span>10s</span></div>');
  });
});

describe('classifyStats', () => {
  it('counts gcd, ogcd, and unknown records', () => {
    expect(classifyStats([
      { category: 'weaponskill' },
      { category: 'spell' },
      { category: 'ability' },
      { category: 'other' },
    ])).toEqual({ gcd: 2, ogcd: 1, unknown: 1, total: 4 });
  });
});

describe('deduplicateTimeline', () => {
  it('drops repeated actions within 0.5 seconds', () => {
    expect(deduplicateTimeline([
      { actionId: 1, t: 1.0 },
      { actionId: 1, t: 1.2 },
      { actionId: 1, t: 1.7 },
      { actionId: 2, t: 1.8 },
    ])).toEqual([
      { actionId: 1, t: 1.0 },
      { actionId: 1, t: 1.7 },
      { actionId: 2, t: 1.8 },
    ]);
  });
});

describe('findEnemyActors', () => {
  function normalizeJobCode(type, subType) {
    return String(subType || type || 'UNK').toUpperCase();
  }

  function isSupportedJob(job) {
    return new Set(['PLD', 'WHM']).has(job);
  }

  it('filters out friendly players, pets, environments, and known player jobs', () => {
    expect(findEnemyActors({
      masterData: {
        actors: [
          { id: 1, name: 'Tank', type: 'Player', subType: 'PLD' },
          { id: 2, name: 'Boss', type: 'Boss' },
          { id: 3, name: 'Pet', type: 'Pet', petOwner: 1 },
          { id: 4, name: 'Environment', type: 'Environment' },
          { id: 5, name: 'WHM Alt', type: 'NPC', subType: 'WHM' },
          { id: 6, name: 'Limit Break', type: 'NPC' },
        ],
      },
    }, {
      friendlyPlayers: [1],
    }, {
      isSupportedJob,
      normalizeJobCode,
    })).toEqual([
      { id: 2, name: 'Boss', type: 'Boss' },
    ]);
  });
});

describe('formatHitType', () => {
  it('formats crit/direct hit combinations', () => {
    expect(formatHitType(2, true)).toBe('CDH');
    expect(formatHitType(2, false)).toBe('Crit');
    expect(formatHitType(1, true)).toBe('DH');
    expect(formatHitType(1, false)).toBe('');
  });
});

describe('formatTimelineTime', () => {
  it('renders tenths when there is a visible fraction', () => {
    expect(formatTimelineTime(65.2)).toBe('1:05.2');
  });

  it('rounds whole seconds when the fraction is tiny', () => {
    expect(formatTimelineTime(59.02)).toBe('0:59');
  });
});
