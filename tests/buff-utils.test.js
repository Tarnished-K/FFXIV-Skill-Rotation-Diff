const { findBurstBuff, findSelfBuff, getActiveSynergies } = require('../scripts/shared/buff-utils');

const BURST_BUFFS = [
  { ids: [100], nameEn: 'Battle Litany', nameJa: 'バトルリタニー', duration: 20 },
];

const SELF_BUFFS = [
  { nameEn: 'Fight or Flight', nameJa: 'ファイト・オア・フライト', duration: 20 },
];

describe('findBurstBuff', () => {
  it('matches burst buffs by id or name', () => {
    expect(findBurstBuff(100, '', BURST_BUFFS)).toEqual(BURST_BUFFS[0]);
    expect(findBurstBuff(0, 'Battle Litany', BURST_BUFFS)).toEqual(BURST_BUFFS[0]);
    expect(findBurstBuff(0, 'バトルリタニー', BURST_BUFFS)).toEqual(BURST_BUFFS[0]);
  });
});

describe('findSelfBuff', () => {
  it('matches self buffs by localized names', () => {
    expect(findSelfBuff('Fight or Flight', SELF_BUFFS)).toEqual(SELF_BUFFS[0]);
    expect(findSelfBuff('ファイト・オア・フライト', SELF_BUFFS)).toEqual(SELF_BUFFS[0]);
  });
});

describe('getActiveSynergies', () => {
  it('collects active self and party buffs in english', () => {
    expect(getActiveSynergies(15, [
      { t: 10, actionId: 100, action: 'Battle Litany' },
      { t: 12, action: 'Fight or Flight' },
    ], [
      { t: 11, action: 'Custom Buff', duration: 10 },
    ], {
      burstBuffs: BURST_BUFFS,
      selfBuffs: SELF_BUFFS,
      lang: 'en',
    })).toEqual(['Battle Litany', 'Fight or Flight', 'Custom Buff']);
  });

  it('returns localized names in japanese', () => {
    expect(getActiveSynergies(15, [
      { t: 10, actionId: 100, action: 'Battle Litany' },
    ], [], {
      burstBuffs: BURST_BUFFS,
      selfBuffs: SELF_BUFFS,
      lang: 'ja',
    })).toEqual(['バトルリタニー']);
  });
});
