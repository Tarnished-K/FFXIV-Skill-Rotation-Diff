(function () {
// FF Logs API access, icon lookup, and report/player data helpers
const { parseFFLogsUrl: parseFFLogsUrlShared } = globalThis.AppSharedUtils;
const {
  detectSavageFloor: detectSavageFloorShared,
  getEncounterDisplayName: getEncounterDisplayNameShared,
  getSavageFloorFromName: getSavageFloorFromNameShared,
  shouldShowUltimatePhaseSelector: shouldShowUltimatePhaseSelectorShared,
} = globalThis.EncounterUtils;
const {
  normalizeActionCategory: normalizeActionCategoryShared,
} = globalThis.TimelineUtils;
const {
  formatPartyComp: formatPartyCompShared,
  getPlayersFromFight: getPlayersFromFightShared,
} = globalThis.PlayerUtils;
const {
  buildFightOptionLabel,
  buildPlayerSelectOptions,
} = globalThis.SelectionUtils;
const ANALYTICS_SESSION_KEY = 'ffxiv_rotation_diff_session_id';
let analyticsSessionId = '';

function parseFFLogsUrl(raw) {
  return parseFFLogsUrlShared(raw);
}
async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(json?.error || `Request failed: ${res.status}`);
  }
  return json;
}

function createAnalyticsSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getAnalyticsSessionId() {
  if (analyticsSessionId) return analyticsSessionId;
  try {
    const existing = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) {
      analyticsSessionId = existing;
      return analyticsSessionId;
    }
  } catch {}

  analyticsSessionId = createAnalyticsSessionId();
  try {
    sessionStorage.setItem(ANALYTICS_SESSION_KEY, analyticsSessionId);
  } catch {}
  return analyticsSessionId;
}

async function sendAnalyticsEvent(eventType, details = {}) {
  try {
    const baseDetails = {
      sessionId: getAnalyticsSessionId(),
    };
    if (typeof state !== 'undefined' && state?.lang) {
      baseDetails.lang = state.lang;
    }
    await postJson('/api/log-event', {
      eventType,
      pathname: window.location.pathname,
      details: {
        ...baseDetails,
        ...details,
      },
    });
  } catch (error) {
    logDebug('analytics skipped', { eventType, error: error.message });
  }
}
async function graphqlRequest(query, variables = {}) {
  const json = await postJson('/api/fflogs-proxy', { query, variables });
  return json?.data;
}
async function fetchReportDataV2(reportCode) {
  const query = `
    query ReportCore($code: String!) {
      reportData {
        report(code: $code) {
          title
          zone { id name }
          phases {
            encounterID
            separatesWipes
            phases {
              id
              name
              isIntermission
            }
          }
          fights {
            id
            encounterID
            name
            kill
            startTime
            endTime
            friendlyPlayers
            lastPhase
            lastPhaseAsAbsoluteIndex
            lastPhaseIsIntermission
            phaseTransitions {
              id
              startTime
            }
          }
          masterData {
            actors {
              id
              name
              type
              subType
              petOwner
            }
            abilities {
              gameID
              name
            }
          }
        }
      }
    }
  `;
  try {
    const data = await graphqlRequest(query, { code: reportCode });
    const report = data?.reportData?.report;
    if (!report) throw new Error('レポートデータ取得に失敗しました');
    if (report.zone) logDebug(`レポート zone: ${report.zone.name || report.zone.id}`);
    return report;
  } catch (e) {
    // zone/lastPhase等がスキーマにない場合フォールバック
    logError('レポート取得リトライ（拡張フィールドなし）', { error: e.message });
    const fallbackQuery = `
      query ReportCore($code: String!) {
        reportData {
          report(code: $code) {
            fights {
              id
              encounterID
              name
              kill
              startTime
              endTime
              friendlyPlayers
            }
            masterData {
              actors { id name type subType petOwner }
              abilities { gameID name }
            }
          }
        }
      }
    `;
    const data = await graphqlRequest(fallbackQuery, { code: reportCode });
    const report = data?.reportData?.report;
    if (!report) throw new Error('レポートデータ取得に失敗しました');
    return report;
  }
}
async function loadIconMap() {
  const candidates = [
    '/public/job-icons/job_icon.json',
    './public/job-icons/job_icon.json',
    '/job-icons/job_icon.json',
    '/public/job-icons/ffxiv_job_action_icon_map.json',
    './public/job-icons/ffxiv_job_action_icon_map.json'
  ];
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const data = await res.json();
      const records = data.records || data;
      logDebug(`icon map loaded: ${path}`, {count: records.length});
      state.actionById = new Map();
      for (const r of records) {
        if (r?.action_id) state.actionById.set(Number(r.action_id), r);
      }
      return records;
    } catch {
      // try next candidate
    }
  }
  state.actionById = new Map();
  logError("icon map not found on all candidate paths");
  return [];
}
function normalizeActionKey(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9぀-ヿ一-龯]/g, '');
}
function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}
function shouldSkipIconLookup(actionName = '') {
  const n = String(actionName || '').toLowerCase();
  return n.includes('sprint')
    || n.includes('スプリント')
    || n.includes('tincture')
    || n.includes('potion')
    || n.includes('薬')
    || n.includes('limit break')
    || n.includes('リミットブレイク');
}
function getActionMeta(actionName, actionId, preferredJobCode = '') {
  let found = null;
  if (actionId && state.actionById.has(Number(actionId))) {
    found = state.actionById.get(Number(actionId));
  }
  if (!found) {
    const key = normalizeActionKey(actionName);
    found = state.iconMap.find(r => {
      const names = [r.action_name_en, r.action_name_ja, ...(r.aliases || [])].map(normalizeActionKey);
      return names.includes(key);
    });
  }
  const nm = String(actionName || '').toLowerCase();
  if (nm.includes('sprint') || nm.includes('スプリント')) {
    return {
      icon: '/public/job-icons/jobs/General/sprint.png',
      iconCandidates: ['/public/job-icons/jobs/General/sprint.png'],
      category: 'ability',
      label: found?.action_name_ja || found?.action_name_en || actionName,
    };
  }
  if (shouldSkipIconLookup(actionName) || shouldSkipIconLookup(found?.action_name_en) || shouldSkipIconLookup(found?.action_name_ja)) {
    return {
      icon: '',
      iconCandidates: [],
      category: String(found?.action_type || '').toLowerCase(),
      label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
    };
  }
  const raw = found?.icon_path || '';
  const iconCandidates = [];
  if (raw) {
    const rawMatch = raw.match(/^\/job-icons\/jobs\/([A-Z]+)\/(.+)$/);
    if (rawMatch) {
      const rawJob = rawMatch[1];
      const targetJob = String(preferredJobCode || rawJob).toUpperCase() || rawJob;
      const rawTail = rawMatch[2];
      const fileName = rawTail.split('/').pop();
      const categoryDir = found?.category === 'role_action'
        ? 'Role_Actions'
        : found?.category === 'trait'
          ? 'Traits'
          : found?.category === 'pet_actions'
            ? 'Pet_Actions'
            : '';
      const tail = categoryDir ? `${categoryDir}/${fileName}` : rawTail;
      if (found?.category === 'role_action') {
        iconCandidates.push(`/public/job-icons/jobs/${targetJob}/Role_Actions/${fileName}`);
        iconCandidates.push(`/public/job-icons/jobs/${rawJob}/Role_Actions/${fileName}`);
      }
      iconCandidates.push(`/public/job-icons/jobs/${targetJob}/${tail}`);
      iconCandidates.push(`/public/job-icons/jobs/${rawJob}/${rawTail}`);
      iconCandidates.push(`/public/job-icons/jobs/${rawJob}/${tail}`);
    }
    iconCandidates.push(raw.startsWith('/job-icons/') ? '/public' + raw : raw);
    iconCandidates.push(raw);
  }
  const uniqueCandidates = uniq(iconCandidates).map(x => encodeURI(x));
  return {
    icon: uniqueCandidates[0] || '',
    iconCandidates: uniqueCandidates,
    category: String(found?.action_type || '').toLowerCase(),
    label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
  };
}
function normalizeJobCode(type, subType) {
  const raw = (subType || type || '').toString().toUpperCase().replace(/[\s-_]/g, '');
  return JOB_CODE_MAP[raw] || raw || 'UNK';
}
function indexAbilities(report) {
  for (const a of report?.masterData?.abilities || []) {
    const id = Number(a?.gameID || 0);
    const name = String(a?.name || '');
    if (id && name && !state.abilityById.has(id)) state.abilityById.set(id, name);
  }
}

function extractSelectableFights(reportJson) {
  // V2では ReportFight に boss が無いので encounterID を使ってボス戦判定
  return (reportJson.fights || []).filter(f => Number(f.encounterID || 0) > 0 && f.kill === true);
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
  } catch { return ''; }
}
function detectSavageFloor(zoneName, fightName, encounterID) {
  return detectSavageFloorShared(zoneName, fightName, state.lang, encounterID);
}
function fillFightSelect(select, fights, reportJson) {
  const zoneName = reportJson?.zone?.name || '';
  select.innerHTML = fights.map((f, i) => {
    const label = buildFightOptionLabel(f, i, {
      baseName: getEncounterDisplayName(reportJson, f) || `Fight ${f.id}`,
      floorTag: detectSavageFloor(zoneName, f.name, f.encounterID),
      partyComp: formatPartyComp(reportJson, f.id),
      statusLabel: f.kill ? t('kill') : t('wipe'),
    });
    return `<option value="${f.id}">${label}</option>`;
  }).join('');
}
function fillPlayerSelect(select, players, dpsEntries, fightDurationMs) {
  select.innerHTML = buildPlayerSelectOptions(players, dpsEntries, fightDurationMs, { formatJobName })
    .map((player) => `<option value="${player.value}">${player.label}</option>`)
    .join('');
}
function getSavageFloorFromName(fightName) {
  return getSavageFloorFromNameShared(fightName);
}
function getEncounterDisplayName(reportJson, fight) {
  return getEncounterDisplayNameShared(reportJson, fight, state.lang);
}
function shouldShowUltimatePhaseSelector(reportJson, fight) {
  return shouldShowUltimatePhaseSelectorShared(reportJson, fight);
}
function normalizeActionCategory(category, actionName, jobCode) {
  return normalizeActionCategoryShared(category, actionName, jobCode);
}

Object.assign(globalThis, {
  FFLogsReport: {
    parseFFLogsUrl,
    graphqlRequest,
    sendAnalyticsEvent,
    fetchReportDataV2,
    loadIconMap,
    extractSelectableFights,
    indexAbilities,
    getPlayersFromFight,
    fillFightSelect,
    fillPlayerSelect,
    getSavageFloorFromName,
    shouldShowUltimatePhaseSelector,
    getActionMeta,
    normalizeActionCategory,
  },
});
}());
