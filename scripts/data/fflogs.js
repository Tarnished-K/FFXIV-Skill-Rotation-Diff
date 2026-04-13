// FFLogs auth, API access, icon lookup, and report/player data helpers

function getRedirectUri() {
  // FFLogs側の登録と完全一致させるため、ルート配下は末尾スラッシュを付けない
  if (window.location.pathname === '/' || window.location.pathname === '') return window.location.origin;
  return window.location.origin + window.location.pathname;
}
function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
}
async function sha256Base64Url(value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function parseFFLogsUrl(raw) {
  try {
    const u = new URL(raw);
    const match = u.pathname.match(/\/reports\/([A-Za-z0-9]+)/);
    if (!match) return null;
    return { reportId: match[1], original: raw };
  } catch {
    return null;
  }
}
async function startOAuthLogin() {
  const verifier = randomString(96);
  const stateVal = randomString(32);
  const challenge = await sha256Base64Url(verifier);
  localStorage.setItem(AUTH_VERIFIER_KEY, verifier);
  localStorage.setItem(AUTH_STATE_KEY, stateVal);
  const params = new URLSearchParams({
    client_id: FFLOGS_V2_CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: stateVal,
  });
  window.location.href = `https://ja.fflogs.com/oauth/authorize?${params.toString()}`;
}
async function exchangeCodeForToken(code) {
  const savedState = localStorage.getItem(AUTH_STATE_KEY);
  const verifier = localStorage.getItem(AUTH_VERIFIER_KEY);
  const currentState = new URLSearchParams(window.location.search).get('state');
  if (!savedState || !verifier || !currentState || savedState !== currentState) {
    throw new Error('OAuth state検証に失敗しました。再連携してください。');
  }
  const body = new URLSearchParams({
    client_id: FFLOGS_V2_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch('https://ja.fflogs.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`token取得失敗: ${res.status}`);
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('access_tokenが返却されませんでした');
  }
  localStorage.setItem(TOKEN_KEY, json.access_token);
  localStorage.removeItem(AUTH_STATE_KEY);
  localStorage.removeItem(AUTH_VERIFIER_KEY);
  history.replaceState({}, '', getRedirectUri());
  return json.access_token;
}
async function restoreOrAuthorize() {
  const qp = new URLSearchParams(window.location.search);
  const oauthError = qp.get('error');
  if (oauthError) {
    const desc = qp.get('error_description') || qp.get('message') || oauthError;
    el.msg.textContent = `FFLogs認証エラー: ${decodeURIComponent(desc)}`;
    history.replaceState({}, '', getRedirectUri());
    state.token = localStorage.getItem(TOKEN_KEY) || '';
    el.authStatus.textContent = state.token ? '連携済み' : '未連携';
    return;
  }
  const code = qp.get('code');
  if (code) {
    state.token = await exchangeCodeForToken(code);
  } else {
    state.token = localStorage.getItem(TOKEN_KEY) || '';
  }
  el.authStatus.textContent = state.token ? '連携済み' : '未連携';
}
async function graphqlRequest(query, variables = {}) {
  if (!state.token) {
    throw new Error('FFLogs連携が必要です');
  }
  const res = await fetch('https://ja.fflogs.com/api/v2/client', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'GraphQLエラー');
  }
  return json.data;
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
  // 零式/Savageコンテンツの何層目かを検出する
  const zn = (zoneName || '').toLowerCase();
  const fn = (fightName || '').toLowerCase();
  const isSavage = zn.includes('savage') || zn.includes('零式');
  if (!isSavage) return '';
  // zone名からフロア番号を抽出 (例: "M1 (Savage)", "P3S", "E8S" 等)
  // パターン: [A-Z]\d+S? or [A-Z]\d+ (Savage)
  const zoneFloorMatch = zoneName.match(/[MEPOmepoa](\d+)/i);
  if (zoneFloorMatch) {
    const floor = zoneFloorMatch[1];
    return state.lang === 'ja' ? `${floor}層` : `F${floor}`;
  }
  // fight名からフロア番号を推定 (例: "1層", "Floor 1")
  const jaFloorMatch = fightName.match(/(\d+)層/);
  if (jaFloorMatch) return state.lang === 'ja' ? `${jaFloorMatch[1]}層` : `F${jaFloorMatch[1]}`;
  const enFloorMatch = fightName.match(/floor\s*(\d+)/i);
  if (enFloorMatch) return state.lang === 'ja' ? `${enFloorMatch[1]}層` : `F${enFloorMatch[1]}`;
  // ゾーン名に "Savage" があるが層番号が取れない場合は零式とだけ表示
  return state.lang === 'ja' ? '零式' : 'Savage';
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
const ULTIMATE_ENCOUNTER_INFO = {
  1073: { ja: '絶バハムート討滅戦', en: 'The Unending Coil of Bahamut', short: 'UCoB' },
  1074: { ja: '絶アルテマウェポン破壊作戦', en: "The Weapon's Refrain", short: 'UWU' },
  1075: { ja: '絶アレキサンダー討滅戦', en: 'The Epic of Alexander', short: 'TEA' },
  1076: { ja: '絶竜詩戦争', en: "Dragonsong's Reprise", short: 'DSR' },
  1077: { ja: '絶オメガ検証戦', en: 'The Omega Protocol', short: 'TOP' },
  1079: { ja: '絶エデン', en: 'Futures Rewritten', short: 'FRU' },
};
const ULTIMATE_PHASE_ENCOUNTERS = Object.values(ULTIMATE_ENCOUNTER_INFO).flatMap(info => [info.ja, info.en, info.short]);
function normalizeEncounterText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9一-龠ぁ-んァ-ヶ]/g, '');
}
function getUltimateEncounterInfo(fight) {
  return ULTIMATE_ENCOUNTER_INFO[Number(fight?.encounterID || 0)] || null;
}
function isGenericZoneName(zoneName) {
  const normalized = normalizeEncounterText(zoneName);
  return normalized === 'ultimateslegacy' || normalized === 'ultimates';
}
function getEncounterDisplayName(reportJson, fight) {
  const encounter = getUltimateEncounterInfo(fight);
  if (encounter) return state.lang === 'ja' ? encounter.ja : encounter.en;
  const zoneName = reportJson?.zone?.name || '';
  if (zoneName && !isGenericZoneName(zoneName)) return zoneName;
  return fight?.name || '';
}
function shouldShowUltimatePhaseSelector(reportJson, fight) {
  if (getUltimateEncounterInfo(fight)) return true;
  const haystack = [
    reportJson?.zone?.name,
    fight?.name,
    reportJson?.title,
  ].map(normalizeEncounterText).join(' ');
  return ULTIMATE_PHASE_ENCOUNTERS.some(name => haystack.includes(normalizeEncounterText(name)));
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
