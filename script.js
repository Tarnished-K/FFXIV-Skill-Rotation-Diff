const FFLOGS_V2_CLIENT_ID = 'a182a7d9-18bd-49d6-a5d3-26f40a3f3a7d';
const AUTH_STATE_KEY = 'fflogs_v2_state';
const AUTH_VERIFIER_KEY = 'fflogs_v2_verifier';
const TOKEN_KEY = 'fflogs_v2_access_token';
const state = {
  iconMap: [],
  token: '',
  urlA: null,
  urlB: null,
  reportA: null,
  reportB: null,
  selectedFightA: null,
  selectedFightB: null,
  playersA: [],
  playersB: [],
  selectedA: null,
  selectedB: null,
  currentTab: 'all',
  timelineA: [],
  timelineB: [],
  dpsA: [],
  dpsB: [],
  timelineCountA: 0,
  timelineCountB: 0,
  actionById: new Map(),
  abilityById: new Map(),
  zoom: 1,
};
const el = {
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  authStatus: document.getElementById('authStatus'),
  urlA: document.getElementById('urlA'),
  urlB: document.getElementById('urlB'),
  loadBtn: document.getElementById('loadBtn'),
  loadPlayersBtn: document.getElementById('loadPlayersBtn'),
  compareBtn: document.getElementById('compareBtn'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  msg: document.getElementById('step1Message'),
  step2Message: document.getElementById('step2Message'),
  fightA: document.getElementById('fightA'),
  fightB: document.getElementById('fightB'),
  playerA: document.getElementById('playerA'),
  playerB: document.getElementById('playerB'),
  tabs: [...document.querySelectorAll('.tab')],
  timelineWrap: document.getElementById('timelineWrap'),
  dpsCanvas: document.getElementById('dpsCanvas'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomLabel: document.getElementById('zoomLabel'),
  debugLog: document.getElementById('debugLog'),
};
function bindClick(node, name, handler) {
  if (!node) {
    console.error(`[bind] missing element: ${name}`);
    return;
  }
  node.addEventListener('click', handler);
}
function logDebug(message, payload = null) {
  const t = new Date().toLocaleTimeString();
  const line = payload ? `[${t}] ${message} ${JSON.stringify(payload).slice(0, 500)}` : `[${t}] ${message}`;
  el.debugLog.textContent += line + "\n";
  el.debugLog.scrollTop = el.debugLog.scrollHeight;
}
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
  const data = await graphqlRequest(query, { code: reportCode });
  const report = data?.reportData?.report;
  if (!report) {
    throw new Error('レポートデータ取得に失敗しました');
  }
  return report;
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
  logDebug("icon map not found on all candidate paths");
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
      category: String(found?.category || found?.action_type || '').toLowerCase(),
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
    category: String(found?.category || found?.action_type || '').toLowerCase(),
    label: found?.action_name_ja || found?.action_name_en || actionName || 'Unknown',
  };
}
function normalizeJobCode(type, subType) {
  const c = (subType || type || '').toString().toUpperCase();
  return c || 'UNK';
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
    .filter(a => (a.type || '').toLowerCase() !== 'pet')
    .filter(a => {
      const n = String(a.name || '').toLowerCase();
      return !n.includes('limit break') && !n.includes('リミットブレイク');
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
function fillFightSelect(select, fights) {
  select.innerHTML = fights.map((f, i) => `<option value="${f.id}">${formatFightLabel(f, i)}</option>`).join('');
}
function fillPlayerSelect(select, players) {
  select.innerHTML = players.map(p => `<option value="${p.id}">${p.name} (${p.job})</option>`).join('');
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
function makeSampleTimeline() {
  const actions = ['Fast Blade', 'Riot Blade', 'Royal Authority', 'Fight or Flight', 'Requiescat'];
  return Array.from({ length: 45 }, (_, i) => ({ t: i * 6, action: actions[i % actions.length] }));
}
function makeSampleDps() {
  let x = 20000;
  return Array.from({ length: 120 }, (_, i) => {
    x += (Math.random() - 0.5) * 1200;
    return { t: i * 5, v: Math.max(1000, Math.round(x)) };
  });
}
function filterTimeline(records, tab) {
  if (tab === 'all') return records;
  if (tab === 'odd') return records.filter(r => Math.floor(r.t / 60) % 2 === 1);
  if (tab === 'even') return records.filter(r => Math.floor(r.t / 60) % 2 === 0 && r.t >= 60);
  return records;
}
function buildRuler(maxT, pxPerSec) {
  const marks = [];
  for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
    const x = 60 + sec * pxPerSec;
    const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
    const label = sec % 5 === 0 ? `<span>${sec}s</span>` : '';
    marks.push(`<div class="tick ${level}" style="left:${x}px">${label}</div>`);
  }
  return `<div class="ruler">${marks.join('')}</div>`;
}
function renderTimeline() {
  const a = filterTimeline(state.timelineA, state.currentTab);
  const b = filterTimeline(state.timelineB, state.currentTab);
  const maxT = Math.max(1, ...a.map(x => x.t), ...b.map(x => x.t));
  const pxPerSec = 16 * state.zoom;
  const width = Math.max(1800, maxT * pxPerSec + 220);
  const laneTop = {
    a_ogcd: 42,
    a_gcd: 122,
    b_ogcd: 262,
    b_gcd: 342,
  };
  const isGcd = r => r.category === 'weaponskill' || r.category === 'spell';
  const buildEvents = (records, owner) => {
    const lanesLastX = { gcd: -999, ogcd: -999 };
    const minGap = 24;
    return records.map(r => {
      const lane = isGcd(r) ? 'gcd' : 'ogcd';
      const baseX = 60 + r.t * pxPerSec;
      const x = Math.max(baseX, lanesLastX[lane] + minGap);
      lanesLastX[lane] = x;
      const icon = r.icon || '';
      const fallback = (r.label || r.action || '?').slice(0, 2).toUpperCase();
      const top = laneTop[`${owner}_${lane}`];
      const candidates = (r.iconCandidates || []).join('|');
      const castBar = Number(r.castEndT) > Number(r.t)
        ? `<div class="cast-bar" style="width:${Math.max(8, (r.castEndT - r.t) * pxPerSec)}px"></div>`
        : '';
      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${r.t.toFixed(1)}s ${r.label || r.action}">${castBar}${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${r.label || r.action}" />` : `<span>${fallback}</span>`}</div>`;
    }).join('');
  };
  el.timelineWrap.innerHTML = `
    <div class="timeline" style="width:${width}px">
      ${buildRuler(maxT, pxPerSec)}
      <div class="track a"></div>
      <div class="track b"></div>
      ${buildEvents(a, 'a')}
      ${buildEvents(b, 'b')}
    </div>
    <div class="legend">上段プレイヤー: ${state.selectedA?.name || 'A'}（上:oGCD/アビリティ / 下:GCD・詠唱）<br/>下段プレイヤー: ${state.selectedB?.name || 'B'}（上:oGCD/アビリティ / 下:GCD・詠唱）</div>
  `;
  el.timelineWrap.querySelectorAll('img.event-icon').forEach(img => {
    const queue = (img.dataset.fallbacks || '').split('|').filter(Boolean);
    const seen = new Set([img.getAttribute('src')]);
    img.addEventListener('error', () => {
      while (queue.length) {
        const next = queue.shift();
        if (!seen.has(next)) {
          seen.add(next);
          img.src = next;
          return;
        }
      }
      img.replaceWith(Object.assign(document.createElement('span'), { textContent: (img.alt || '?').slice(0, 2).toUpperCase() }));
    });
  });
}
function renderDps() {
  const cvs = el.dpsCanvas;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  const maxV = Math.max(...state.dpsA.map(p => p.v), ...state.dpsB.map(p => p.v), 1);
  const drawLine = (arr, color) => {
    ctx.beginPath();
    arr.forEach((p, i) => {
      const x = (p.t / 600) * (cvs.width - 40) + 20;
      const y = cvs.height - 20 - (p.v / maxV) * (cvs.height - 40);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  drawLine(state.dpsA, '#38bdf8');
  drawLine(state.dpsB, '#f97316');
}
bindClick(el.connectBtn, 'connectBtn', () => {
  logDebug('click: connect');
  startOAuthLogin().catch(e => {
    el.msg.textContent = `連携開始失敗: ${e.message}`;
  });
});
bindClick(el.disconnectBtn, 'disconnectBtn', () => {
  logDebug('click: disconnect');
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_STATE_KEY);
  localStorage.removeItem(AUTH_VERIFIER_KEY);
  state.token = '';
  el.authStatus.textContent = '未連携';
  el.msg.textContent = 'FFLogs連携を解除しました。';
});
bindClick(el.loadBtn, 'loadBtn', async () => {
  logDebug('click: load reports', {urlA: el.urlA.value, urlB: el.urlB.value});
  const parsedA = parseFFLogsUrl(el.urlA.value.trim());
  const parsedB = parseFFLogsUrl(el.urlB.value.trim());
  if (!state.token) {
    el.msg.textContent = '先に「FFLogsと連携（V2）」を実行してください。';
    return;
  }
  if (!parsedA || !parsedB) {
    el.msg.textContent = 'FFLogs URL形式を確認してください。';
    return;
  }
  el.loadBtn.disabled = true;
  el.msg.textContent = 'V2でレポートを読み込み中...';
  el.step2Message.textContent = '';
  try {
    state.urlA = parsedA;
    state.urlB = parsedB;
    state.iconMap = await loadIconMap();
    if (!state.iconMap.length) {
      el.msg.textContent = '警告: アイコン対応表JSONが見つかりません。UN表示になります。';
    }
    state.reportA = await fetchReportDataV2(parsedA.reportId);
    state.reportB = await fetchReportDataV2(parsedB.reportId);
    state.abilityById = new Map();
    indexAbilities(state.reportA);
    indexAbilities(state.reportB);
    logDebug('ability map indexed', {count: state.abilityById.size});
    const fightsA = extractSelectableFights(state.reportA);
    const fightsB = extractSelectableFights(state.reportB);
    if (!fightsA.length || !fightsB.length) throw new Error('選択可能なKill戦闘が見つかりませんでした。');
    fillFightSelect(el.fightA, fightsA);
    fillFightSelect(el.fightB, fightsB);
    el.playerA.innerHTML = '';
    el.playerB.innerHTML = '';
    el.step2.classList.remove('hidden');
    el.step3.classList.add('hidden');
    el.step4.classList.add('hidden');
    el.msg.textContent = `Kill戦闘一覧取得成功: A=${fightsA.length}件 / B=${fightsB.length}件`;
  } catch (e) {
    el.msg.textContent = `取得失敗: ${e.message}`;
  } finally {
    el.loadBtn.disabled = false;
  }
});
bindClick(el.loadPlayersBtn, 'loadPlayersBtn', () => {
  logDebug('click: load players', {fightA: el.fightA.value, fightB: el.fightB.value});
  try {
    state.selectedFightA = Number(el.fightA.value);
    state.selectedFightB = Number(el.fightB.value);
    state.playersA = getPlayersFromFight(state.reportA, state.selectedFightA);
    state.playersB = getPlayersFromFight(state.reportB, state.selectedFightB);
    fillPlayerSelect(el.playerA, state.playersA);
    fillPlayerSelect(el.playerB, state.playersB);
    el.step3.classList.remove('hidden');
    el.step4.classList.add('hidden');
    el.step2Message.textContent = `プレイヤー取得成功: A=${state.playersA.length}人 / B=${state.playersB.length}人`;
  } catch (e) {
    el.step2Message.textContent = `プレイヤー取得失敗: ${e.message}`;
  }
});
bindClick(el.compareBtn, 'compareBtn', async () => {
  logDebug('click: compare', {playerA: el.playerA.value, playerB: el.playerB.value});
  state.selectedA = state.playersA.find(p => p.id === el.playerA.value);
  state.selectedB = state.playersB.find(p => p.id === el.playerB.value);
  if (!state.selectedA || !state.selectedB) return;
  const fightA = (state.reportA?.fights || []).find(f => Number(f.id) === Number(state.selectedFightA));
  const fightB = (state.reportB?.fights || []).find(f => Number(f.id) === Number(state.selectedFightB));
  el.step2Message.textContent = '選択プレイヤーのTLを取得中...';
  try {
    state.timelineA = await fetchPlayerTimelineV2(state.urlA.reportId, fightA, Number(state.selectedA.id), state.selectedA.job);
    state.timelineB = await fetchPlayerTimelineV2(state.urlB.reportId, fightB, Number(state.selectedB.id), state.selectedB.job);
    state.timelineCountA = state.timelineA.length;
    state.timelineCountB = state.timelineB.length;
    state.dpsA = makeSampleDps();
    state.dpsB = makeSampleDps();
    el.step2Message.textContent = `TL取得成功: A=${state.timelineA.length}件 / B=${state.timelineB.length}件`;
  } catch (e) {
    // 失敗時もUI確認できるようサンプルでフォールバック
    state.timelineA = makeSampleTimeline();
    state.timelineB = makeSampleTimeline();
    state.timelineCountA = state.timelineA.length;
    state.timelineCountB = state.timelineB.length;
    state.dpsA = makeSampleDps();
    state.dpsB = makeSampleDps();
    el.step2Message.textContent = `TL取得失敗(サンプル表示): ${e.message}`;
  }
  el.step4.classList.remove('hidden');
  state.currentTab = 'all';
  el.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
  el.dpsCanvas.classList.add('hidden');
  el.timelineWrap.classList.remove('hidden');
  renderTimeline();
});
bindClick(el.zoomInBtn, 'zoomInBtn', () => {
  state.zoom = Math.min(3, +(state.zoom + 0.25).toFixed(2));
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  if (!el.timelineWrap.classList.contains('hidden')) renderTimeline();
  logDebug('zoom in', {zoom: state.zoom});
});
bindClick(el.zoomOutBtn, 'zoomOutBtn', () => {
  state.zoom = Math.max(0.5, +(state.zoom - 0.25).toFixed(2));
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  if (!el.timelineWrap.classList.contains('hidden')) renderTimeline();
  logDebug('zoom out', {zoom: state.zoom});
});
el.tabs.forEach((tab, i) => {
  bindClick(tab, `tab-${i}`, () => {
    el.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentTab = tab.dataset.tab;
    if (state.currentTab === 'dps') {
      el.timelineWrap.classList.add('hidden');
      el.dpsCanvas.classList.remove('hidden');
      renderDps();
    } else {
      el.dpsCanvas.classList.add('hidden');
      el.timelineWrap.classList.remove('hidden');
      renderTimeline();
    }
  });
});
try {
  logDebug('script initialized');
  restoreOrAuthorize().catch(e => {
    if (el.msg) el.msg.textContent = `認証初期化失敗: ${e.message}`;
    logDebug('auth init failed', { message: e.message });
  });
} catch (e) {
  if (el.msg) el.msg.textContent = `初期化失敗: ${e.message}`;
  console.error(e);
}
