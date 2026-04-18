(function attachEncounterUtils(root, factory) {
  const exports = factory();
  root.EncounterUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createEncounterUtils() {
  const ULTIMATE_ENCOUNTER_INFO = {
    1073: { ja: '絶バハムート討滅戦', en: 'The Unending Coil of Bahamut', short: 'UCoB' },
    1074: { ja: '絶アルテマウェポン破壊作戦', en: "The Weapon's Refrain", short: 'UWU' },
    1075: { ja: '絶アレキサンダー討滅戦', en: 'The Epic of Alexander', short: 'TEA' },
    1076: { ja: '絶竜詩戦争', en: "Dragonsong's Reprise", short: 'DSR' },
    1077: { ja: '絶オメガ検証戦', en: 'The Omega Protocol', short: 'TOP' },
    1079: { ja: '絶エデン', en: 'Futures Rewritten', short: 'FRU' },
  };

  const ULTIMATE_PHASE_ENCOUNTERS = Object.values(ULTIMATE_ENCOUNTER_INFO)
    .flatMap((info) => [info.ja, info.en, info.short]);

  const SAVAGE_BOSS_INFO = [
    { patterns: [/black cat/i, /ブラックキャット/], ja: 'ブラックキャット', en: 'Black Cat', tier: { ja: 'ライトヘビー級', en: 'Light-heavyweight' }, floor: 1 },
    { patterns: [/honey b\.?\s*lovely/i, /ハニー[・.]?B[・.]?ラブリー/], ja: 'ハニー・B・ラブリー', en: 'Honey B. Lovely', tier: { ja: 'ライトヘビー級', en: 'Light-heavyweight' }, floor: 2 },
    { patterns: [/brute bomber/i, /ブルートボンバー/], ja: 'ブルートボンバー', en: 'Brute Bomber', tier: { ja: 'ライトヘビー級', en: 'Light-heavyweight' }, floor: 3 },
    { patterns: [/wicked thunder/i, /ウィケッドサンダー/], ja: 'ウィケッドサンダー', en: 'Wicked Thunder', tier: { ja: 'ライトヘビー級', en: 'Light-heavyweight' }, floor: 4 },
    { patterns: [/dancing green/i, /ダンシング[・.]?グリーン/], ja: 'ダンシング・グリーン', en: 'Dancing Green', tier: { ja: 'クルーザー級', en: 'Cruiserweight' }, floor: 1 },
    { patterns: [/sugar riot/i, /シュガーライオット/], ja: 'シュガーライオット', en: 'Sugar Riot', tier: { ja: 'クルーザー級', en: 'Cruiserweight' }, floor: 2 },
    { patterns: [/brute abominator/i, /ブルートアボミネーター/], ja: 'ブルートアボミネーター', en: 'Brute Abominator', tier: { ja: 'クルーザー級', en: 'Cruiserweight' }, floor: 3 },
    { patterns: [/howling blade/i, /ハウリングブレード/], ja: 'ハウリングブレード', en: 'Howling Blade', tier: { ja: 'クルーザー級', en: 'Cruiserweight' }, floor: 4 },
    { patterns: [/vamp fatale/i, /ヴァンプ[・.]?ファタール/], ja: 'ヴァンプ・ファタール', en: 'Vamp Fatale', tier: { ja: 'ヘビー級', en: 'Heavyweight' }, floor: 1 },
    { patterns: [/red hot/i, /deep blue/i, /the extremes?|extremes?/i, /エクストリームズ/], ja: 'エクストリームズ', en: 'The Extremes', tier: { ja: 'ヘビー級', en: 'Heavyweight' }, floor: 2 },
    { patterns: [/the tyrant|tyrant/i, /タイラント/], ja: 'ザ・タイラント', en: 'The Tyrant', tier: { ja: 'ヘビー級', en: 'Heavyweight' }, floor: 3 },
    { patterns: [/lindwurm[\s　]*(ii|ⅱ|Ⅱ|2)/i, /リンドヴルム[\s　]*(ii|ⅱ|Ⅱ|2)/i], ja: 'リンドヴルム II', en: 'Lindwurm II', tier: { ja: 'ヘビー級', en: 'Heavyweight' }, floor: 4, phase: { ja: '後半', en: 'P2' } },
    { patterns: [/lindblum/i, /リンドブルム/, /lindwurm(?![\s　]*(ii|ⅱ|Ⅱ|2))/i, /リンドヴルム(?![\s　]*(ii|ⅱ|Ⅱ|2))/i], ja: 'リンドブルム', en: 'Lindblum', tier: { ja: 'ヘビー級', en: 'Heavyweight' }, floor: 4, phase: { ja: '前半', en: 'P1' } },
  ];

  const SAVAGE_ZONE_PATTERNS = [
    {
      patterns: [/aac\s*light[-\s]?heavyweight/i, /aaclightheavyweight/i],
      ja: 'アルカディアライトヘビー級零式',
      en: 'AAC Light-heavyweight (Savage)',
    },
    {
      patterns: [/aac\s*heavyweight/i, /aacheavyweight/i],
      ja: 'アルカディアヘビー級零式',
      en: 'AAC Heavyweight (Savage)',
    },
    {
      patterns: [/aac\s*cruiserweight/i, /aaccruiserweight/i],
      ja: 'アルカディアクルーザー級零式',
      en: 'AAC Cruiserweight (Savage)',
    },
    {
      patterns: [/the arcadion/i, /arcadion/i],
      ja: 'アルカディア零式',
      en: 'The Arcadion (Savage)',
    },
  ];

  function normalizeEncounterText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/g, '');
  }

  function getUltimateEncounterInfo(fight) {
    return ULTIMATE_ENCOUNTER_INFO[Number(fight?.encounterID || 0)] || null;
  }

  function isGenericZoneName(zoneName) {
    const normalized = normalizeEncounterText(zoneName);
    return normalized === 'ultimateslegacy' || normalized === 'ultimates';
  }

  function stripSavageFloorSuffix(zoneName) {
    return String(zoneName || '')
      .replace(/\s+[MF]\d+\s*\(Savage\)$/i, ' (Savage)')
      .trim();
  }

  function getSavageBossDisplayName(fightName, lang = 'en') {
    const name = String(fightName || '');
    for (const boss of SAVAGE_BOSS_INFO) {
      if (boss.patterns.some((p) => p.test(name))) {
        const phase = boss.phase ? (lang === 'ja' ? boss.phase.ja : boss.phase.en) : '';
        return lang === 'ja'
          ? `${boss.tier.ja}零式${boss.floor}層${phase}`
          : `AAC ${boss.tier.en} M${boss.floor}${phase ? ' ' + phase : ''}`;
      }
    }
    return null;
  }

  function getSavageFloorFromName(fightName) {
    const name = String(fightName || '');
    for (const boss of SAVAGE_BOSS_INFO) {
      if (boss.patterns.some((p) => p.test(name))) return boss.floor;
    }
    return null;
  }

  function getSavageZoneDisplayName(zoneName, lang = 'en') {
    const rawZoneName = String(zoneName || '').trim();
    if (!rawZoneName) return '';
    for (const entry of SAVAGE_ZONE_PATTERNS) {
      if (entry.patterns.some((pattern) => pattern.test(rawZoneName))) {
        return lang === 'ja' ? entry.ja : entry.en;
      }
    }
    return stripSavageFloorSuffix(rawZoneName);
  }

  function getEncounterDisplayName(reportJson, fight, lang = 'en') {
    const encounter = getUltimateEncounterInfo(fight);
    if (encounter) return lang === 'ja' ? encounter.ja : encounter.en;

    const bossDisplay = getSavageBossDisplayName(fight?.name, lang);
    if (bossDisplay) return bossDisplay;

    const zoneName = reportJson?.zone?.name || '';
    if (zoneName && !isGenericZoneName(zoneName)) {
      return getSavageZoneDisplayName(zoneName, lang);
    }

    return getSavageZoneDisplayName(fight?.name || '', lang);
  }

  // encounterID → 層番号マップ（確認済みIDを追加していく）
  const SAVAGE_ENCOUNTER_FLOOR = {
    // 例: 1082: { floor: 1, tier: 'Heavyweight' }
  };

  function detectSavageFloor(zoneName, fightName, lang = 'en', encounterID = 0) {
    const zoneText = String(zoneName || '');
    const fightText = String(fightName || '');
    const normalizedZone = zoneText.toLowerCase();
    const isSavage = normalizedZone.includes('savage') || normalizedZone.includes('零式');
    if (!isSavage) return '';

    // encounterIDが既知なら層を直接返す
    const encFloor = SAVAGE_ENCOUNTER_FLOOR[Number(encounterID || 0)];
    if (encFloor) return lang === 'ja' ? `${encFloor.floor}層` : `F${encFloor.floor}`;

    // ボス名が特定できていればbaseName側に層情報が入るのでタグ不要
    if (SAVAGE_BOSS_INFO.some(b => b.patterns.some(p => p.test(fightText)))) return '';

    const zoneFloorMatch = zoneText.match(/[MEPOmepoa](\d+)/i);
    if (zoneFloorMatch) {
      const floor = zoneFloorMatch[1];
      return lang === 'ja' ? `${floor}層` : `F${floor}`;
    }

    const jaFloorMatch = fightText.match(/(\d+)層/);
    if (jaFloorMatch) return lang === 'ja' ? `${jaFloorMatch[1]}層` : `F${jaFloorMatch[1]}`;

    const enFloorMatch = fightText.match(/floor\s*(\d+)/i);
    if (enFloorMatch) return lang === 'ja' ? `${enFloorMatch[1]}層` : `F${enFloorMatch[1]}`;

    // ゾーン名自体にボスパターンが含まれるケース（fight.nameがzone名と同一の場合）
    const bossFromZone = SAVAGE_BOSS_INFO.find(b => b.patterns.some(p => p.test(zoneText)));
    if (bossFromZone) return lang === 'ja' ? `${bossFromZone.floor}層` : `F${bossFromZone.floor}`;

    return lang === 'ja' ? '層不明' : 'Floor ?';
  }

  function shouldShowUltimatePhaseSelector(reportJson, fight) {
    if (getUltimateEncounterInfo(fight)) return true;
    const haystack = [
      reportJson?.zone?.name,
      fight?.name,
      reportJson?.title,
    ].map(normalizeEncounterText).join(' ');
    return ULTIMATE_PHASE_ENCOUNTERS.some((name) => haystack.includes(normalizeEncounterText(name)));
  }

  return {
    detectSavageFloor,
    getEncounterDisplayName,
    getSavageFloorFromName,
    getUltimateEncounterInfo,
    isGenericZoneName,
    normalizeEncounterText,
    shouldShowUltimatePhaseSelector,
    ULTIMATE_ENCOUNTER_INFO,
  };
}));
