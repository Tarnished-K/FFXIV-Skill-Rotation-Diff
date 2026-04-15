// FFLogs API access, icon lookup, and report/player data helpers
const { parseFFLogsUrl: parseFFLogsUrlShared } = globalThis.AppSharedUtils;
const {
  detectSavageFloor: detectSavageFloorShared,
  getEncounterDisplayName: getEncounterDisplayNameShared,
  shouldShowUltimatePhaseSelector: shouldShowUltimatePhaseSelectorShared,
} = globalThis.EncounterUtils;
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
function formatDurationMs(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
function formatFightLabel(fight, index) {
  const duration = formatDurationMs((fight.endTime || 0) - (fight.startTime || 0));
  const status = fight.kill ? 'Kill' : 'Wipe';
  const name = fight.name || `Fight ${fight.id}`;
  return `#${index + 1} ${name} / ${duration} / ${status}`;
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
  const fight = (reportJson.fights || []).find(f => Number(f.id) === Number(fightId));
  if (!fight) throw new Error(`fight=${fightId} が見つかりません`);
  const allowedIds = new Set(fight.friendlyPlayers || []);
  const base = (reportJson.masterData?.actors || [])
    .filter(a => !a.petOwner)
    .filter(a => {
      const tl = (a.type || '').toLowerCase();
      return tl !== 'pet' && tl !== 'npc' && tl !== 'boss' && tl !== 'environment';
    })
    .filter(a => {
      const n = String(a.name || '').toLowerCase();
      return !n.includes('limit break') && !n.includes('リミットブレイク');
    })
    .filter(a => {
      // ジョブコードに変換できるactorのみ（NPC等を除外）
      const job = normalizeJobCode(a.type, a.subType);
      return job !== 'UNK' && !!JOB_ROLE[job];
    });
  // V2では actor.fights が取得できないため、fight.friendlyPlayers を主軸に絞る
  let filtered = base.filter(a => (allowedIds.size > 0 ? allowedIds.has(a.id) : true));
  // fallback: friendlyPlayers が空の場合のみ全actorから採用
  if (!filtered.length && allowedIds.size === 0) filtered = base;
  const players = filtered
    .map(a => ({
      id: String(a.id),
      name: a.name || `Unknown-${a.id}`,
      job: normalizeJobCode(a.type, a.subType),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  if (!players.length) throw new Error('選択戦闘に紐づくプレイヤー一覧を取得できませんでした');
  return players;
}
function formatPartyComp(reportJson, fightId) {
  try {
    const players = getPlayersFromFight(reportJson, fightId);
    const sorted = [...players].sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(JOB_ROLE[a.job] || 'D');
      const rb = ROLE_ORDER.indexOf(JOB_ROLE[b.job] || 'D');
      return ra - rb;
    });
    if (state.lang === 'ja') {
      return sorted.map(p => JOB_SHORT_JA[p.job] || p.job).join('');
    }
    return sorted.map(p => p.job).join(',');
  } catch { return ''; }
}
function detectSavageFloor(zoneName, fightName) {
  return detectSavageFloorShared(zoneName, fightName, state.lang);
}
function fillFightSelect(select, fights, reportJson) {
  const zoneName = reportJson?.zone?.name || '';
  select.innerHTML = fights.map((f, i) => {
    const comp = formatPartyComp(reportJson, f.id);
    const duration = formatDurationMs((f.endTime || 0) - (f.startTime || 0));
    const status = f.kill ? t('kill') : t('wipe');
    const baseName = getEncounterDisplayName(reportJson, f) || `Fight ${f.id}`;
    const floorTag = detectSavageFloor(zoneName, f.name);
    const name = floorTag ? `${baseName} (${floorTag})` : baseName;
    const phaseInfo = f.lastPhase > 1 ? ` P${f.lastPhase}` : '';
    const compStr = comp ? ` [${comp}]` : '';
    return `<option value="${f.id}">#${i + 1} ${name}${phaseInfo} / ${duration} / ${status}${compStr}</option>`;
  }).join('');
}
function fillPlayerSelect(select, players, dpsEntries, fightDurationMs) {
  const dpsMap = new Map();
  const fightSec = (fightDurationMs || 1) / 1000;
  for (const e of (dpsEntries || [])) {
    const id = String(e.id);
    const activeSec = Math.max(1, Number(e.activeTimeReduced || e.activeTime || fightDurationMs || 1000) / 1000);
    const rDps = Math.round(
      Number.isFinite(Number(e.rDPS)) && Number(e.rDPS) > 0
        ? Number(e.rDPS)
        : Number(e.totalRDPS || 0) > 0
          ? Number(e.totalRDPS) / activeSec
          : Number(e.total || 0) / activeSec
    );
    const aDps = Math.round(
      Number.isFinite(Number(e.aDPS)) && Number(e.aDPS) > 0
        ? Number(e.aDPS)
        : Number(e.totalADPS || 0) > 0
          ? Number(e.totalADPS) / activeSec
          : Number(e.total || 0) / fightSec
    );
    dpsMap.set(id, { rDps, aDps });
  }
  select.innerHTML = players.map(p => {
    const jobLabel = formatJobName(p.job);
    const dps = dpsMap.get(p.id);
    const dpsStr = dps ? ` rDPS:${dps.rDps} aDPS:${dps.aDps}` : '';
    return `<option value="${p.id}">${p.name} (${jobLabel})${dpsStr}</option>`;
  }).join('');
}
function getEncounterDisplayName(reportJson, fight) {
  return getEncounterDisplayNameShared(reportJson, fight, state.lang);
}
function shouldShowUltimatePhaseSelector(reportJson, fight) {
  return shouldShowUltimatePhaseSelectorShared(reportJson, fight);
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
          category: meta.category,
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
      all.push({ t, action: String(name), actionId, category: meta.category, icon: meta.icon, iconCandidates: meta.iconCandidates || [], label: meta.label });
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  return all.sort((a, b) => a.t - b.t);
}
