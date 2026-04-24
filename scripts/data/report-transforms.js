// FFLogs report shaping helpers shared by bootstrap and data fetchers
const {
  detectSavageFloor: detectSavageFloorShared,
  getEncounterDisplayName: getEncounterDisplayNameShared,
} = globalThis.EncounterUtils;
const {
  normalizeActionCategory: normalizeActionCategoryShared,
} = globalThis.TimelineUtils;
const {
  formatPartyComp: formatPartyCompShared,
  getPlayersFromFight: getPlayersFromFightShared,
} = globalThis.PlayerUtils;

function normalizeJobCode(type, subType) {
  const raw = (subType || type || '').toString().toUpperCase().replace(/[\s-_]/g, '');
  return JOB_CODE_MAP[raw] || raw || 'UNK';
}

function indexAbilities(report) {
  for (const ability of report?.masterData?.abilities || []) {
    const id = Number(ability?.gameID || 0);
    const name = String(ability?.name || '');
    if (id && name && !state.abilityById.has(id)) state.abilityById.set(id, name);
  }
}

function extractSelectableFights(reportJson) {
  return (reportJson.fights || []).filter((fight) => Number(fight.encounterID || 0) > 0 && fight.kill === true);
}

function getPlayersFromFight(reportJson, fightId) {
  return getPlayersFromFightShared(reportJson, fightId, {
    normalizeJobCode,
    isSupportedJob(job) {
      return job !== 'UNK' && !!JOB_ROLE[job];
    },
  });
}

function formatPartyComp(reportJson, fightId) {
  try {
    return formatPartyCompShared(getPlayersFromFight(reportJson, fightId), {
      jobRole: JOB_ROLE,
      jobShortJa: JOB_SHORT_JA,
      lang: state.lang,
      roleOrder: ROLE_ORDER,
    });
  } catch {
    return '';
  }
}

function detectSavageFloor(zoneName, fightName, encounterID) {
  return detectSavageFloorShared(zoneName, fightName, state.lang, encounterID);
}

function getEncounterDisplayName(reportJson, fight) {
  return getEncounterDisplayNameShared(reportJson, fight, state.lang);
}

function normalizeActionCategory(category, actionName, jobCode) {
  return normalizeActionCategoryShared(category, actionName, jobCode);
}

Object.assign(globalThis, {
  detectSavageFloor,
  extractSelectableFights,
  formatPartyComp,
  getEncounterDisplayName,
  getPlayersFromFight,
  indexAbilities,
  normalizeActionCategory,
  normalizeJobCode,
});
