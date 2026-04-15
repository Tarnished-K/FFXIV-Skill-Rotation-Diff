const { formatPartyComp, getPlayersFromFight } = require('../scripts/shared/player-utils');

function normalizeJobCode(type, subType) {
  const raw = String(subType || type || '').toUpperCase();
  const map = {
    PALADIN: 'PLD',
    WHITE_MAGE: 'WHM',
    WHITEMAGE: 'WHM',
    DANCER: 'DNC',
    PLD: 'PLD',
    WHM: 'WHM',
    DNC: 'DNC',
  };
  return map[raw] || 'UNK';
}

function isSupportedJob(job) {
  return new Set(['PLD', 'WHM', 'DNC']).has(job);
}

describe('getPlayersFromFight', () => {
  it('filters actors to supported players in the selected fight', () => {
    const players = getPlayersFromFight({
      fights: [
        { id: 11, friendlyPlayers: [1, 2, 3] },
      ],
      masterData: {
        actors: [
          { id: 1, name: 'Tank', type: 'Paladin' },
          { id: 2, name: 'Healer', type: 'WhiteMage' },
          { id: 3, name: 'Dancer', type: 'Dancer' },
          { id: 4, name: 'Pet', type: 'Pet' },
          { id: 5, name: 'Limit Break', type: 'Player' },
        ],
      },
    }, 11, {
      isSupportedJob,
      normalizeJobCode,
    });

    expect(players).toEqual([
      { id: '3', name: 'Dancer', job: 'DNC' },
      { id: '2', name: 'Healer', job: 'WHM' },
      { id: '1', name: 'Tank', job: 'PLD' },
    ]);
  });

  it('throws when the fight is missing', () => {
    expect(() => getPlayersFromFight({ fights: [] }, 99, {
      isSupportedJob,
      normalizeJobCode,
    })).toThrow('fight=99 が見つかりません');
  });
});

describe('formatPartyComp', () => {
  it('formats a localized compact party string', () => {
    const party = formatPartyComp([
      { job: 'DNC' },
      { job: 'WHM' },
      { job: 'PLD' },
    ], {
      jobRole: { PLD: 'T', WHM: 'H', DNC: 'D' },
      jobShortJa: { PLD: 'ナ', WHM: '白', DNC: '踊' },
      lang: 'ja',
      roleOrder: ['T', 'H', 'D'],
    });

    expect(party).toBe('ナ白踊');
  });

  it('formats an english party string ordered by role', () => {
    const party = formatPartyComp([
      { job: 'DNC' },
      { job: 'WHM' },
      { job: 'PLD' },
    ], {
      jobRole: { PLD: 'T', WHM: 'H', DNC: 'D' },
      lang: 'en',
      roleOrder: ['T', 'H', 'D'],
    });

    expect(party).toBe('PLD,WHM,DNC');
  });
});
