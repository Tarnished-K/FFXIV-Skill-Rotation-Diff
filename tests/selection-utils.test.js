const {
  buildFightOptionLabel,
  buildPlayerOptionLabel,
  buildPlayerSelectOptions,
  formatDurationMs,
  summarizePlayerDpsEntry,
} = require('../scripts/shared/selection-utils');

describe('formatDurationMs', () => {
  it('formats millisecond durations as minute-second strings', () => {
    expect(formatDurationMs(125000)).toBe('2:05');
  });
});

describe('buildFightOptionLabel', () => {
  it('includes floor, phase, duration, status, and party composition', () => {
    const label = buildFightOptionLabel({
      id: 42,
      startTime: 1000,
      endTime: 126000,
      lastPhase: 3,
      kill: true,
    }, 1, {
      baseName: 'Futures Rewritten',
      floorTag: 'F4',
      partyComp: 'PLD,WHM,DNC',
      statusLabel: 'Kill',
    });

    expect(label).toBe('#2 Futures Rewritten (F4) P3 / 2:05 / Kill [PLD,WHM,DNC]');
  });
});

describe('summarizePlayerDpsEntry', () => {
  it('prefers provided rdps/adps values when available', () => {
    expect(summarizePlayerDpsEntry({
      id: 10,
      rDPS: 1234.4,
      aDPS: 2345.6,
      total: 999999,
    }, 120000)).toEqual({
      id: '10',
      rDps: 1234,
      aDps: 2346,
    });
  });

  it('falls back to totals when rdps/adps are missing', () => {
    expect(summarizePlayerDpsEntry({
      id: 11,
      totalRDPS: 10000,
      totalADPS: 16000,
      activeTime: 10000,
      total: 30000,
    }, 20000)).toEqual({
      id: '11',
      rDps: 1000,
      aDps: 1600,
    });
  });
});

describe('buildPlayerOptionLabel', () => {
  it('appends rdps and adps text when a summary is available', () => {
    expect(buildPlayerOptionLabel({
      name: 'Alpha',
      job: 'PLD',
    }, {
      jobLabel: 'PLD',
      dps: { rDps: 1234, aDps: 1567 },
    })).toBe('Alpha (PLD) rDPS:1234 aDPS:1567');
  });
});

describe('buildPlayerSelectOptions', () => {
  it('builds player option values and labels from player and dps data', () => {
    expect(buildPlayerSelectOptions([
      { id: '1', name: 'Alpha', job: 'PLD' },
      { id: '2', name: 'Beta', job: 'WHM' },
    ], [
      { id: '1', rDPS: 1234, aDPS: 1567 },
    ], 10000, {
      formatJobName(jobCode) {
        return jobCode.toLowerCase();
      },
    })).toEqual([
      { value: '1', label: 'Alpha (pld) rDPS:1234 aDPS:1567' },
      { value: '2', label: 'Beta (whm)' },
    ]);
  });
});
