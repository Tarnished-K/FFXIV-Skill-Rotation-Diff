const {
  detectSavageFloor,
  getEncounterDisplayName,
  getUltimateEncounterInfo,
  normalizeEncounterText,
  shouldShowUltimatePhaseSelector,
} = require('../scripts/shared/encounter-utils');

describe('normalizeEncounterText', () => {
  it('normalizes mixed-language encounter text for matching', () => {
    expect(normalizeEncounterText(' Futures Rewritten / 絶エデン ')).toBe('futuresrewritten絶エデン');
  });
});

describe('getUltimateEncounterInfo', () => {
  it('returns metadata for supported ultimate encounters', () => {
    expect(getUltimateEncounterInfo({ encounterID: 1079 })).toEqual({
      ja: '絶エデン',
      en: 'Futures Rewritten',
      short: 'FRU',
    });
  });
});

describe('getEncounterDisplayName', () => {
  it('prefers localized ultimate names when available', () => {
    expect(getEncounterDisplayName({}, { encounterID: 1079 }, 'ja')).toBe('絶エデン');
    expect(getEncounterDisplayName({}, { encounterID: 1079 }, 'en')).toBe('Futures Rewritten');
  });

  it('resolves display name from boss name (fight.name) for known savage bosses', () => {
    expect(getEncounterDisplayName({}, { name: 'Black Cat' }, 'en'))
      .toBe('AAC Light-heavyweight M1');
    expect(getEncounterDisplayName({}, { name: 'Black Cat' }, 'ja'))
      .toBe('ライトヘビー級零式1層');
    expect(getEncounterDisplayName({}, { name: 'Howling Blade' }, 'en'))
      .toBe('AAC Cruiserweight M4');
    expect(getEncounterDisplayName({}, { name: 'Howling Blade' }, 'ja'))
      .toBe('クルーザー級零式4層');
  });

  it('falls back to zone-name pattern when boss name is unknown', () => {
    expect(getEncounterDisplayName({ zone: { name: 'AACHeavyWeight M4 (Savage)' } }, { name: 'Unknown Boss' }, 'ja'))
      .toBe('アルカディアヘビー級零式');
    expect(getEncounterDisplayName({ zone: { name: 'AACHeavyWeight' } }, { name: 'Unknown Boss' }, 'en'))
      .toBe('AAC Heavyweight (Savage)');
  });
});

describe('detectSavageFloor', () => {
  it('extracts floor labels from savage zone names', () => {
    expect(detectSavageFloor('AAC Light-heavyweight M2 (Savage)', 'Honey B. Lovely', 'ja')).toBe('2層');
    expect(detectSavageFloor('AAC Light-heavyweight M2 (Savage)', 'Honey B. Lovely', 'en')).toBe('F2');
  });

  it('falls back to generic savage labels when no floor number is available', () => {
    expect(detectSavageFloor('The Arcadion (Savage)', 'Unknown Boss', 'ja')).toBe('零式');
    expect(detectSavageFloor('The Arcadion (Savage)', 'Unknown Boss', 'en')).toBe('Savage');
  });
});

describe('shouldShowUltimatePhaseSelector', () => {
  it('returns true for known ultimate encounter ids', () => {
    expect(shouldShowUltimatePhaseSelector({}, { encounterID: 1077 })).toBe(true);
  });

  it('returns true when the encounter name appears in report metadata', () => {
    expect(shouldShowUltimatePhaseSelector({
      zone: { name: 'Ultimates (Legacy)' },
      title: 'Static FRU practice',
    }, {
      encounterID: 0,
      name: 'Futures Rewritten',
    })).toBe(true);
  });
});
