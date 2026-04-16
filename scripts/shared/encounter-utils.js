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

    const zoneName = reportJson?.zone?.name || '';
    if (zoneName && !isGenericZoneName(zoneName)) {
      const normalizedZone = zoneName.toLowerCase();
      const isSavage = normalizedZone.includes('savage') || normalizedZone.includes('零式');
      return isSavage ? getSavageZoneDisplayName(zoneName, lang) : zoneName;
    }

    return fight?.name || '';
  }

  function detectSavageFloor(zoneName, fightName, lang = 'en') {
    const zoneText = String(zoneName || '');
    const fightText = String(fightName || '');
    const normalizedZone = zoneText.toLowerCase();
    const isSavage = normalizedZone.includes('savage') || normalizedZone.includes('零式');
    if (!isSavage) return '';

    const zoneFloorMatch = zoneText.match(/[MEPOmepoa](\d+)/i);
    if (zoneFloorMatch) {
      const floor = zoneFloorMatch[1];
      return lang === 'ja' ? `${floor}層` : `F${floor}`;
    }

    const jaFloorMatch = fightText.match(/(\d+)層/);
    if (jaFloorMatch) return lang === 'ja' ? `${jaFloorMatch[1]}層` : `F${jaFloorMatch[1]}`;

    const enFloorMatch = fightText.match(/floor\s*(\d+)/i);
    if (enFloorMatch) return lang === 'ja' ? `${enFloorMatch[1]}層` : `F${enFloorMatch[1]}`;

    return lang === 'ja' ? '零式' : 'Savage';
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
    getUltimateEncounterInfo,
    isGenericZoneName,
    normalizeEncounterText,
    shouldShowUltimatePhaseSelector,
    ULTIMATE_ENCOUNTER_INFO,
  };
}));
