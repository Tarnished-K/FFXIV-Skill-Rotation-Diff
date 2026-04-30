const {
  buildFightPhasesFromFFLogs,
  buildPhaseStarts,
  detectPhasesFromBossCasts,
  formatPhaseLabel,
  mergePhaseSets,
  normalizePhaseTransitionStartTime,
} = require('../scripts/shared/phase-utils');

describe('buildPhaseStarts', () => {
  it('builds phases from boundary times', () => {
    expect(buildPhaseStarts([20], 40, 0)).toEqual([
      { id: 1, startT: 0, endT: 20, label: 'P1' },
      { id: 2, startT: 20, endT: 40, label: 'P2' },
    ]);
  });

  it('fills missing phases by splitting the widest span', () => {
    expect(buildPhaseStarts([20], 40, 3)).toEqual([
      { id: 1, startT: 0, endT: 10, label: 'P1' },
      { id: 2, startT: 10, endT: 20, label: 'P2' },
      { id: 3, startT: 20, endT: 40, label: 'P3' },
    ]);
  });
});

describe('detectPhasesFromBossCasts', () => {
  it('detects phase boundaries from boss swaps and cast gaps', () => {
    const result = detectPhasesFromBossCasts([
      { sourceName: 'Boss A', t: 1, endT: 2 },
      { sourceName: 'Boss A', t: 4, endT: 6 },
      { sourceName: 'Boss B', t: 20, endT: 21 },
    ], 40, 2);

    expect(result.phases).toEqual([
      { id: 1, startT: 0, endT: 20, label: 'P1' },
      { id: 2, startT: 20, endT: 40, label: 'P2' },
    ]);
    expect(result.boundaryTimes).toContain(20);
  });

  it('falls back to synthetic phase splits when only lastPhase is available', () => {
    const result = detectPhasesFromBossCasts([], 40, 2);
    expect(result.usedFallbackSplit).toBe(true);
    expect(result.phases).toEqual([
      { id: 1, startT: 0, endT: 20, label: 'P1' },
      { id: 2, startT: 20, endT: 40, label: 'P2' },
    ]);
  });
});

describe('normalizePhaseTransitionStartTime', () => {
  it('normalizes absolute timestamps into fight-relative seconds', () => {
    expect(normalizePhaseTransitionStartTime(11000, { startTime: 1000, endTime: 31000 })).toBe(10);
  });
});

describe('buildFightPhasesFromFFLogs', () => {
  it('builds labeled phases from FF Logs metadata and transitions', () => {
    const phases = buildFightPhasesFromFFLogs({
      phases: [
        {
          encounterID: 1079,
          phases: [
            { id: 1, name: 'Phase 1', isIntermission: false },
            { id: 2, name: '', isIntermission: true },
            { id: 3, name: 'Final', isIntermission: false },
          ],
        },
      ],
    }, {
      encounterID: 1079,
      startTime: 1000,
      endTime: 31000,
      lastPhaseAsAbsoluteIndex: 3,
      phaseTransitions: [
        { id: 2, startTime: 11000 },
        { id: 3, startTime: 21000 },
      ],
    }, {
      getPhaseLabel(meta, fallbackIndex) {
        if (meta?.name) return meta.name;
        if (meta?.isIntermission) return `Intermission ${fallbackIndex}`;
        return `P${fallbackIndex}`;
      },
    });

    expect(phases).toEqual([
      { id: 1, phaseId: 1, startT: 0, endT: 10, label: 'Phase 1', isIntermission: false },
      { id: 2, phaseId: 2, startT: 10, endT: 20, label: 'Intermission 2', isIntermission: true },
      { id: 3, phaseId: 3, startT: 20, endT: 30, label: 'Final', isIntermission: false },
    ]);
  });
});

describe('formatPhaseLabel', () => {
  it('returns localized fallback labels without relying on app state', () => {
    expect(formatPhaseLabel({ isIntermission: true }, 2, 'ja')).toBe('間奏2');
    expect(formatPhaseLabel({ isIntermission: true }, 2, 'en')).toBe('Intermission 2');
    expect(formatPhaseLabel({}, 3, 'ja')).toBe('P3');
  });
});

describe('mergePhaseSets', () => {
  it('merges phase arrays while preserving per-side windows', () => {
    expect(mergePhaseSets(
      [{ label: 'P1', startT: 0, endT: 10 }],
      [{ label: 'P1', startT: 0, endT: 12 }, { label: 'P2', startT: 12, endT: 24 }],
    )).toEqual([
      {
        id: 1,
        label: 'P1',
        startT: 0,
        endT: 10,
        a: { label: 'P1', startT: 0, endT: 10 },
        b: { label: 'P1', startT: 0, endT: 12 },
      },
      {
        id: 2,
        label: 'P2',
        startT: 12,
        endT: 24,
        a: null,
        b: { label: 'P2', startT: 12, endT: 24 },
      },
    ]);
  });
});
