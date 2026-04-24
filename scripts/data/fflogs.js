// FFLogs API access, icon lookup, and report/player data helpers
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
async function fetchPlayerTimelineV2(reportCode, fight, sourceId, playerJobCode = '') {
  const all = [];
  const pendingBegincast = new Map();
  let startTime = null;
  const query = `
    query PlayerCasts($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Casts, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  while (true) {
    const vars = {
      code: reportCode,
      fightID: Number(fight.id),
      sourceID: Number(sourceId),
      startTime,
    };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    if (rows.length && all.length === 0) logDebug("events sample", rows[0]);
    for (const e of rows) {
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const resolvedName = e?.ability?.name || e?.abilityName || state.abilityById.get(actionId) || '';
      const meta = getActionMeta(resolvedName, actionId, playerJobCode);
      const name = meta.label || resolvedName || '';
      const ts = Number(e?.timestamp || 0);
      if (!name || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const type = String(e?.type || '').toLowerCase();
      const key = String(actionId || name);
      if (type === 'begincast') {
        if (!pendingBegincast.has(key)) pendingBegincast.set(key, []);
        pendingBegincast.get(key).push({
          t,
          action: String(name),
          actionId,
          category: normalizeActionCategory(meta.category, name, playerJobCode),
          icon: meta.icon,
          iconCandidates: meta.iconCandidates || [],
          label: meta.label,
        });
        continue;
      }
      if (type === 'cast' && pendingBegincast.has(key) && pendingBegincast.get(key).length) {
        const startEvent = pendingBegincast.get(key).shift();
        all.push({ ...startEvent, castEndT: t });
        continue;
      }
      all.push({
        t,
        action: String(name),
        actionId,
        category: normalizeActionCategory(meta.category, name, playerJobCode),
        icon: meta.icon,
        iconCandidates: meta.iconCandidates || [],
        label: meta.label,
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all.sort((a, b) => a.t - b.t);
}

async function fetchFightDpsV2(reportCode, fightId) {
  const query = `
    query FightDps($code: String!, $fightID: [Int!]!) {
      reportData {
        report(code: $code) {
          table(dataType: DamageDone, fightIDs: $fightID)
        }
      }
    }
  `;
  try {
    const data = await graphqlRequest(query, { code: reportCode, fightID: [Number(fightId)] });
    const entries = data?.reportData?.report?.table?.data?.entries || [];
    if (entries.length) {
      const sample = entries[0];
      logDebug('DPS table sample', { keys: Object.keys(sample), name: sample.name, total: sample.total, activeTime: sample.activeTime, rDPS: sample.rDPS, aDPS: sample.aDPS });
    }
    return entries;
  } catch (e) {
    logError('DPS table fetch failed', { error: e.message });
    return [];
  }
}

async function fetchPlayerDamageV2(reportCode, fight, sourceId) {
  const all = [];
  let startTime = null;
  const query = `
    query PlayerDamage($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: DamageDone, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(sourceId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const e of rows) {
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const ts = Number(e?.timestamp || 0);
      if (!actionId || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      all.push({
        t,
        actionId,
        amount: Number(e?.amount || 0),
        hitType: Number(e?.hitType || 0),
        multistrike: !!e?.multistrike,
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all;
}

async function fetchPartyDamageV2(reportCode, fight) {
  const all = [];
  const friendlyIds = new Set((fight?.friendlyPlayers || []).map((id) => Number(id)));
  let startTime = null;
  const query = `
    query PartyDamage($code: String!, $fightID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: DamageDone, fightIDs: [$fightID], startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const e of rows) {
      const sourceId = Number(e?.sourceID || e?.source?.id || 0);
      if (friendlyIds.size && !friendlyIds.has(sourceId)) continue;
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const ts = Number(e?.timestamp || 0);
      if (!actionId || !ts) continue;
      all.push({
        t: Math.max(0, (ts - Number(fight.startTime || 0)) / 1000),
        actionId,
        amount: Number(e?.amount || 0),
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all;
}

async function fetchPlayerHealingV2(reportCode, fight, sourceId) {
  const all = [];
  let startTime = null;
  const query = `
    query PlayerHealing($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Healing, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(sourceId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    for (const e of rows) {
      const actionId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const ts = Number(e?.timestamp || 0);
      if (!actionId || !ts) continue;
      const t = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      all.push({
        t,
        actionId,
        amount: Number(e?.amount || 0),
        overheal: Number(e?.overheal || 0),
      });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all;
}

const PARTY_SYNERGY_ACTIONS = [
  { ids: [7396], nameEn: 'Brotherhood', nameJa: '桃園結義', duration: 20, color: '#f472b6' },
  { ids: [7398], nameEn: 'Battle Litany', nameJa: 'バトルリタニー', duration: 20, color: '#60a5fa' },
  { ids: [24405], nameEn: 'Arcane Circle', nameJa: 'アルケインサークル', duration: 20, color: '#c084fc' },
  { ids: [118, 25786], nameEn: 'Battle Voice', nameJa: 'バトルボイス', duration: 20, color: '#a3e635' },
  { ids: [25785], nameEn: 'Radiant Finale', nameJa: '光神のフィナーレ', duration: 20, color: '#fb923c' },
  {
    ids: [],
    nameEn: 'Quadruple Technical Finish',
    nameJa: 'クワッド・テクニカルフィニッシュ',
    duration: 20,
    color: '#34d399',
    aliases: ['Quad Technical Finish', 'Quad. Technical Finish', 'クワッドテクニカルフィニッシュ'],
  },
  { ids: [25801], nameEn: 'Searing Light', nameJa: 'シアリングライト', duration: 20, color: '#fcd34d' },
  { ids: [7520], nameEn: 'Embolden', nameJa: 'エンボルデン', duration: 20, color: '#f87171' },
  { ids: [], nameEn: 'Starry Muse', nameJa: 'イマジンスカイ', duration: 20, color: '#38bdf8', aliases: ['Imagined Sky', 'スターリーミューズ'] },
  { ids: [16552], nameEn: 'Divination', nameJa: 'ディヴィネーション', duration: 20, color: '#fbbf24' },
  { ids: [36871], nameEn: 'Dokumori', nameJa: '毒盛の術', duration: 20, color: '#86efac' },
  { ids: [7436], nameEn: 'Chain Stratagem', nameJa: '連環計', duration: 20, color: '#a78bfa' },
];

function normalizeSynergyName(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findPartySynergyAction(actionId, actionName) {
  const id = Number(actionId || 0);
  if (id) {
    const byId = PARTY_SYNERGY_ACTIONS.find((action) => action.ids.includes(id));
    if (byId) return byId;
  }
  const normalized = normalizeSynergyName(actionName);
  if (!normalized) return null;
  return PARTY_SYNERGY_ACTIONS.find((action) => {
    const names = [action.nameEn, action.nameJa, ...(action.aliases || [])];
    return names.some((name) => normalizeSynergyName(name) === normalized);
  }) || null;
}

async function fetchPartySynergyCastsV2(reportCode, fight, players, selectedPlayerId) {
  const partyMembers = (players || []).filter((player) => String(player.id) !== String(selectedPlayerId));
  const query = `
    query PartySynergyCasts($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Casts, fightIDs: [$fightID], sourceID: $sourceID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  const all = [];
  await Promise.all(partyMembers.map(async (player) => {
    let startTime = null;
    while (true) {
      const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(player.id), startTime };
      const data = await graphqlRequest(query, vars);
      const block = data?.reportData?.report?.events;
      const rows = block?.data || [];
      for (const event of rows) {
        const type = String(event?.type || '').toLowerCase();
        if (type !== 'cast') continue;
        const actionId = Number(event?.abilityGameID || event?.ability?.guid || 0);
        const abilityName = String(event?.ability?.name || event?.abilityName || state.abilityById.get(actionId) || '');
        const synergy = findPartySynergyAction(actionId, abilityName);
        if (!synergy) continue;
        const laneOrder = PARTY_SYNERGY_ACTIONS.indexOf(synergy);
        const meta = getActionMeta(abilityName || synergy.nameEn, actionId, player.job);
        const icon = synergy.icon || meta.icon;
        const iconCandidates = synergy.icon
          ? [synergy.icon, ...(meta.iconCandidates || [])]
          : (meta.iconCandidates || []);
        const ts = Number(event?.timestamp || 0);
        if (!ts) continue;
        all.push({
          t: Math.max(0, (ts - Number(fight.startTime || 0)) / 1000),
          actionId,
          action: synergy.nameEn,
          label: state.lang === 'ja' ? synergy.nameJa : synergy.nameEn,
          laneKey: synergy.nameEn,
          laneOrder: laneOrder >= 0 ? laneOrder : 999,
          duration: synergy.duration,
          color: synergy.color,
          icon,
          iconCandidates,
          sourceId: String(player.id),
          sourceName: player.name || '',
          sourceJob: player.job || '',
        });
      }
      if (!block?.nextPageTimestamp) break;
      startTime = block.nextPageTimestamp;
    }
  }));
  const seen = new Set();
  return all
    .sort((a, b) => a.t - b.t)
    .filter((record) => {
      const key = `${record.sourceId}:${record.actionId || record.action}:${Math.round(record.t * 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

Object.assign(globalThis, {
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
  fetchFightDpsV2,
  fetchPartyDamageV2,
  fetchPlayerDamageV2,
  fetchPlayerHealingV2,
  fetchPlayerTimelineV2,
  fetchPartySynergyCastsV2,
});
