const FFLOGS_V2_CLIENT_ID = 'a182a7d9-18bd-49d6-a5d3-26f40a3f3a7d';
const AUTH_STATE_KEY = 'fflogs_v2_state';
const AUTH_VERIFIER_KEY = 'fflogs_v2_verifier';
const TOKEN_KEY = 'fflogs_v2_access_token';

const JOB_CODE_MAP = {
  PALADIN: 'PLD', WARRIOR: 'WAR', DARKKNIGHT: 'DRK', GUNBREAKER: 'GNB',
  WHITEMAGE: 'WHM', SCHOLAR: 'SCH', ASTROLOGIAN: 'AST', SAGE: 'SGE',
  MONK: 'MNK', DRAGOON: 'DRG', NINJA: 'NIN', SAMURAI: 'SAM', REAPER: 'RPR', VIPER: 'VPR',
  BARD: 'BRD', MACHINIST: 'MCH', DANCER: 'DNC',
  BLACKMAGE: 'BLM', SUMMONER: 'SMN', REDMAGE: 'RDM', PICTOMANCER: 'PCT',
  // already-abbreviated pass-through
  PLD: 'PLD', WAR: 'WAR', DRK: 'DRK', GNB: 'GNB',
  WHM: 'WHM', SCH: 'SCH', AST: 'AST', SGE: 'SGE',
  MNK: 'MNK', DRG: 'DRG', NIN: 'NIN', SAM: 'SAM', RPR: 'RPR', VPR: 'VPR',
  BRD: 'BRD', MCH: 'MCH', DNC: 'DNC',
  BLM: 'BLM', SMN: 'SMN', RDM: 'RDM', PCT: 'PCT',
};

const BURST_BUFFS = [
  { ids: [7398],  nameEn: 'Battle Litany',    nameJa: 'バトルリタニー',      duration: 20, color: '#60a5fa' },
  { ids: [7396],  nameEn: 'Brotherhood',       nameJa: '桃園結義',           duration: 20, color: '#f472b6' },
  { ids: [16552], nameEn: 'Divination',        nameJa: 'ディヴィネーション',   duration: 20, color: '#fbbf24' },
  { ids: [7436],  nameEn: 'Chain Stratagem',   nameJa: '連環計',             duration: 20, color: '#a78bfa' },
  { ids: [7520],  nameEn: 'Embolden',          nameJa: 'エンボルデン',        duration: 20, color: '#f87171' },
  { ids: [24405], nameEn: 'Arcane Circle',     nameJa: 'アルカナサークル',     duration: 20, color: '#c084fc' },
  { ids: [15998], nameEn: 'Technical Finish',  nameJa: 'テクニカルフィニッシュ', duration: 20, color: '#34d399' },
  { ids: [25801], nameEn: 'Searing Light',     nameJa: 'シアリングライト',     duration: 20, color: '#fcd34d' },
  { ids: [25785], nameEn: 'Radiant Finale',    nameJa: 'ラジアントフィナーレ',  duration: 20, color: '#fb923c' },
  { ids: [34681], nameEn: 'Starry Muse',       nameJa: 'スターリーミューズ',    duration: 20, color: '#38bdf8' },
  { ids: [36871], nameEn: 'Dokumori',          nameJa: '毒盛り',             duration: 20, color: '#86efac' },
];

const SELF_BUFFS = [
  { nameEn: 'Fight or Flight',  nameJa: 'ファイト・オア・フライト', duration: 20, color: '#fbbf24' },
  { nameEn: 'Inner Release',    nameJa: '原初の解放',             duration: 15, color: '#ef4444' },
  { nameEn: 'Blood Weapon',     nameJa: 'ブラッドウェポン',       duration: 15, color: '#dc2626' },
  { nameEn: 'Delirium',         nameJa: 'ブラッドデリリアム',      duration: 15, color: '#b91c1c' },
  { nameEn: 'No Mercy',         nameJa: 'ノー・マーシー',         duration: 20, color: '#f59e0b' },
  { nameEn: 'Riddle of Fire',   nameJa: '紅蓮の極意',            duration: 20, color: '#ea580c' },
  { nameEn: 'Lance Charge',     nameJa: 'ランスチャージ',         duration: 20, color: '#3b82f6' },
  { nameEn: 'Raging Strikes',   nameJa: '猛者の撃',             duration: 20, color: '#f97316' },
  { nameEn: 'Wildfire',         nameJa: 'ワイルドファイア',       duration: 10, color: '#ef4444' },
  { nameEn: 'Devilment',        nameJa: '攻めのタンゴ',          duration: 20, color: '#ec4899' },
  { nameEn: 'Ley Lines',        nameJa: '黒魔紋',               duration: 30, color: '#8b5cf6' },
  { nameEn: 'Manafication',     nameJa: 'マナフィケーション',     duration: 15, color: '#6366f1' },
  { nameEn: 'Meikyo Shisui',    nameJa: '明鏡止水',             duration: 15, color: '#06b6d4' },
];

const JOB_NAME_JA = {
  PLD:'ナイト', WAR:'戦士', DRK:'暗黒騎士', GNB:'ガンブレイカー',
  WHM:'白魔道士', SCH:'学者', AST:'占星術師', SGE:'賢者',
  MNK:'モンク', DRG:'竜騎士', NIN:'忍者', SAM:'侍', RPR:'リーパー', VPR:'ヴァイパー',
  BRD:'吟遊詩人', MCH:'機工士', DNC:'踊り子',
  BLM:'黒魔道士', SMN:'召喚士', RDM:'赤魔道士', PCT:'ピクトマンサー',
};

const JOB_ROLE = {
  PLD:'T', WAR:'T', DRK:'T', GNB:'T',
  WHM:'H', SCH:'H', AST:'H', SGE:'H',
  MNK:'D', DRG:'D', NIN:'D', SAM:'D', RPR:'D', VPR:'D',
  BRD:'D', MCH:'D', DNC:'D',
  BLM:'D', SMN:'D', RDM:'D', PCT:'D',
};

const JOB_SHORT_JA = {
  PLD:'ナ', WAR:'戦', DRK:'暗', GNB:'ガ',
  WHM:'白', SCH:'学', AST:'占', SGE:'賢',
  MNK:'モ', DRG:'竜', NIN:'忍', SAM:'侍', RPR:'リ', VPR:'ヴ',
  BRD:'詩', MCH:'機', DNC:'踊',
  BLM:'黒', SMN:'召', RDM:'赤', PCT:'ピ',
};

const ROLE_ORDER = ['T','H','D'];

const DEBUFF_IDS = {
  damageDown: { nameEn: 'Damage Down', nameJa: '与ダメージ低下', color: '#ef4444' },
  weakness:   { nameEn: 'Weakness',    nameJa: '衰弱',         color: '#f59e0b' },
  brink:      { nameEn: 'Brink of Death', nameJa: '衰弱[強]',  color: '#dc2626' },
};

const I18N = {
  en: {
    siteTitle: 'FFXIV Skill Rotation Diff',
    siteDesc: 'Compare skill rotations from 2 FFLogs URLs',
    step1Title: '1. FFLogs Auth & Log URL Input',
    connectBtn: 'Connect to FFLogs (V2)',
    disconnectBtn: 'Disconnect',
    authConnected: 'Connected',
    authDisconnected: 'Not connected',
    logUrlA: 'Log URL A',
    logUrlB: 'Log URL B',
    loadBtn: 'Load Reports',
    step2Title: '2. Select Fight Data (Kill only)',
    logAFight: 'Log A Fight',
    logBFight: 'Log B Fight',
    loadPlayersBtn: 'Get Players for This Fight',
    step3Title: '3. Select Players to Compare',
    logAPlayer: 'Log A Player',
    logBPlayer: 'Log B Player',
    compareBtn: 'Start Comparison',
    step4Title: '4. Comparison Results',
    tabAll: 'Full TL',
    tabOdd: 'Odd Min TL',
    tabEven: 'Even Min TL',
    laneAbility: 'Ability',
    laneGcd: 'WS / Spell',
    laneDebuff: 'Debuff',
    laneBoss: 'Boss Cast',
    debugTitle: 'Debug Log',
    footerNote: 'Note: Connects via FFLogs V2 (PKCE). Select a fight first, then select players.',
    needAuth: 'Please connect to FFLogs (V2) first.',
    badUrl: 'Please check FFLogs URL format.',
    loading: 'Loading reports via V2...',
    killFightsLoaded: (a,b) => `Kill fights loaded: A=${a} / B=${b}`,
    playersLoaded: (a,b) => `Players loaded: A=${a} / B=${b}`,
    tlLoading: 'Loading player timeline...',
    tlLoaded: (a,b) => `TL loaded: A=${a} / B=${b}`,
    disconnected: 'FFLogs disconnected.',
    kill: 'Kill',
    wipe: 'Wipe',
    encounterMismatch: 'Cannot compare different bosses. Please select the same encounter.',
    phaseAll: 'All Phases',
  },
  ja: {
    siteTitle: 'FFXIV スキル回し比較',
    siteDesc: 'FFLogs URL 2件からスキル回しを比較するMVP',
    step1Title: '1. FFLogs連携 & ログURL入力',
    connectBtn: 'FFLogsと連携（V2）',
    disconnectBtn: '連携解除',
    authConnected: '連携済み',
    authDisconnected: '未連携',
    logUrlA: 'ログURL A',
    logUrlB: 'ログURL B',
    loadBtn: '読み込み開始',
    step2Title: '2. 戦闘データ選択（Killのみ）',
    logAFight: 'ログA 戦闘',
    logBFight: 'ログB 戦闘',
    loadPlayersBtn: 'この戦闘でプレイヤー一覧を取得',
    step3Title: '3. 比較プレイヤー選択',
    logAPlayer: 'ログAプレイヤー',
    logBPlayer: 'ログBプレイヤー',
    compareBtn: '比較開始',
    step4Title: '4. 比較結果',
    tabAll: '全体TL',
    tabOdd: '奇数分TL',
    tabEven: '偶数分TL',
    laneAbility: 'アビリティ',
    laneGcd: 'WS・魔法',
    laneDebuff: 'デバフ',
    laneBoss: 'ボス詠唱',
    debugTitle: 'Debug Log',
    footerNote: '注: FFLogs V2(PKCE)で連携。まず戦闘を選んでからプレイヤーを選択します。',
    needAuth: '先に「FFLogsと連携（V2）」を実行してください。',
    badUrl: 'FFLogs URL形式を確認してください。',
    loading: 'V2でレポートを読み込み中...',
    killFightsLoaded: (a,b) => `Kill戦闘一覧取得成功: A=${a}件 / B=${b}件`,
    playersLoaded: (a,b) => `プレイヤー取得成功: A=${a}人 / B=${b}人`,
    tlLoading: '選択プレイヤーのTLを取得中...',
    tlLoaded: (a,b) => `TL取得成功: A=${a}件 / B=${b}件`,
    disconnected: 'FFLogs連携を解除しました。',
    kill: 'Kill',
    wipe: 'Wipe',
    encounterMismatch: '異なるボスの戦闘は比較できません。同じ敵を選択してください。',
    phaseAll: '全フェーズ',
  },
};

function t(key) { return I18N[state.lang]?.[key] ?? I18N.en[key] ?? key; }

const state = {
  iconMap: [],
  token: '',
  lang: 'ja',
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
  timelineCountA: 0,
  timelineCountB: 0,
  actionById: new Map(),
  abilityById: new Map(),
  zoom: 2,
  damageA: [],
  damageB: [],
  bossCastsA: [],
  bossCastsB: [],
  debuffsA: [],
  debuffsB: [],
  partyBuffsA: [],
  partyBuffsB: [],
  rollingDpsA: [],
  rollingDpsB: [],
  phases: [],
  currentPhase: null,
  dpsDataA: null,
  dpsDataB: null,
  fightA: null,
  fightB: null,
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
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomLabel: document.getElementById('zoomLabel'),
  phaseContainer: document.getElementById('phaseContainer'),
  debugLog: document.getElementById('debugLog'),
  langToggle: document.getElementById('langToggle'),
  siteTitle: document.getElementById('siteTitle'),
  siteDesc: document.getElementById('siteDesc'),
  step1Title: document.getElementById('step1Title'),
  step2Title: document.getElementById('step2Title'),
  step3Title: document.getElementById('step3Title'),
  step4Title: document.getElementById('step4Title'),
  debugTitle: document.getElementById('debugTitle'),
  footerNote: document.getElementById('footerNote'),
  logUrlALabel: document.getElementById('logUrlALabel'),
  logUrlBLabel: document.getElementById('logUrlBLabel'),
  logAFightLabel: document.getElementById('logAFightLabel'),
  logBFightLabel: document.getElementById('logBFightLabel'),
  logAPlayerLabel: document.getElementById('logAPlayerLabel'),
  logBPlayerLabel: document.getElementById('logBPlayerLabel'),
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
          title
          zone { id name }
          fights {
            id
            encounterID
            name
            kill
            startTime
            endTime
            friendlyPlayers
            lastPhase
            lastPhaseIsIntermission
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
    logDebug('レポート取得リトライ（拡張フィールドなし）', { error: e.message });
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
      const typeUpper = (a.type || '').toUpperCase().replace(/[\s-_]/g, '');
      return !!JOB_CODE_MAP[typeUpper];
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
function fillFightSelect(select, fights, reportJson) {
  const zoneName = reportJson?.zone?.name || '';
  select.innerHTML = fights.map((f, i) => {
    const comp = formatPartyComp(reportJson, f.id);
    const duration = formatDurationMs((f.endTime || 0) - (f.startTime || 0));
    const status = f.kill ? t('kill') : t('wipe');
    // zone名（コンテンツ名）があればそちらを優先、なければfight.name（ボス名）
    const name = zoneName || f.name || `Fight ${f.id}`;
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
    const activeSec = (e.activeTime || 1) / 1000;
    const rDps = Math.round(e.rDPS || e.total / activeSec || 0);
    const aDps = Math.round(e.aDPS || e.total / fightSec || 0);
    dpsMap.set(id, { rDps, aDps });
  }
  select.innerHTML = players.map(p => {
    const jobLabel = formatJobName(p.job);
    const dps = dpsMap.get(p.id);
    const dpsStr = dps ? ` rDPS:${dps.rDps} aDPS:${dps.aDps}` : '';
    return `<option value="${p.id}">${p.name} (${jobLabel})${dpsStr}</option>`;
  }).join('');
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
function classifyStats(records) {
  let gcd = 0, ogcd = 0, unknown = 0;
  for (const r of records) {
    if (r.category === 'weaponskill' || r.category === 'spell') gcd++;
    else if (r.category === 'ability') ogcd++;
    else unknown++;
  }
  return { gcd, ogcd, unknown, total: records.length };
}
function deduplicateTimeline(records) {
  const out = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const prev = out[out.length - 1];
    if (prev && prev.actionId === r.actionId && Math.abs(prev.t - r.t) < 0.5) continue;
    out.push(r);
  }
  return out;
}
function findSelfBuff(actionName) {
  const n = String(actionName || '').toLowerCase();
  for (const buff of SELF_BUFFS) {
    if (n === buff.nameEn.toLowerCase() || n === buff.nameJa) return buff;
  }
  return null;
}
function getActiveSynergies(t, allRecords, partyBuffRecords) {
  const active = new Set();
  // 自分のキャスト記録からバフ検出
  for (const r of allRecords) {
    const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action);
    if (!buff) continue;
    if (t >= r.t && t <= r.t + buff.duration) {
      active.add(state.lang === 'ja' ? buff.nameJa : buff.nameEn);
    }
  }
  // パーティメンバーからのバフ記録（Buffs APIから取得）
  for (const r of (partyBuffRecords || [])) {
    const dur = r.duration || 20;
    if (t >= r.t && t <= r.t + dur) {
      const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action);
      const label = buff
        ? (state.lang === 'ja' ? buff.nameJa : buff.nameEn)
        : r.action;
      active.add(label);
    }
  }
  return [...active];
}
function findEnemyActors(reportJson, fight) {
  const friendlyIds = new Set(fight.friendlyPlayers || []);
  return (reportJson?.masterData?.actors || []).filter(a => {
    if (a.petOwner) return false;
    if (friendlyIds.has(a.id)) return false;
    const typeUpper = (a.type || '').toUpperCase().replace(/[\s-_]/g, '');
    if (JOB_CODE_MAP[typeUpper]) return false;
    const n = String(a.name || '').toLowerCase();
    if (n.includes('limit break') || n.includes('リミットブレイク')) return false;
    return true;
  });
}

async function fetchBossCastsV2(reportCode, fight, reportJson) {
  // masterData.actorsから敵NPCを特定し、sourceID指定で詠唱を取得
  const enemyActors = findEnemyActors(reportJson, fight);
  logDebug('ボス詠唱: 敵NPC候補', enemyActors.slice(0, 10).map(a => `${a.name}(id=${a.id},type=${a.type})`));
  if (!enemyActors.length) {
    logDebug('ボス詠唱: 敵NPCが見つかりません');
    return [];
  }

  const all = [];
  const pendingBegincast = new Map();
  const query = `
    query BossCasts($code: String!, $fightID: Int!, $sourceID: Int!, $startTime: Float) {
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

  for (const enemy of enemyActors) {
    let startTime = null;
    let enemyCastCount = 0;
    while (true) {
      const vars = { code: reportCode, fightID: Number(fight.id), sourceID: Number(enemy.id), startTime };
      const data = await graphqlRequest(query, vars);
      const block = data?.reportData?.report?.events;
      const rows = block?.data || [];
      for (const e of rows) {
        const name = e?.ability?.name || '';
        const ts = Number(e?.timestamp || 0);
        if (!name || !ts) continue;
        const tSec = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
        const type = String(e?.type || '').toLowerCase();
        const key = `${enemy.id}_${name}`;
        if (type === 'begincast') {
          if (!pendingBegincast.has(key)) pendingBegincast.set(key, []);
          pendingBegincast.get(key).push({ t: tSec, name });
          enemyCastCount++;
          continue;
        }
        if (type === 'cast' && pendingBegincast.has(key) && pendingBegincast.get(key).length) {
          const start = pendingBegincast.get(key).shift();
          const castDuration = tSec - start.t;
          if (castDuration > 0.5) {
            all.push({ t: start.t, endT: tSec, name, duration: castDuration });
          }
          continue;
        }
      }
      if (!block?.nextPageTimestamp) break;
      startTime = block.nextPageTimestamp;
    }
    if (enemyCastCount > 0) logDebug(`  ${enemy.name}: rawイベント${enemyCastCount}件`);
  }
  logDebug(`ボス詠唱結果: ${all.length}件（詠唱バー付き）`);
  return all.sort((a, b) => a.t - b.t);
}
async function fetchPlayerAurasV2(reportCode, fight, targetId) {
  // プレイヤーに適用された全オーラ（バフ+デバフ）を取得し、デバフとPTバフに分離
  const debuffs = [];
  const partyBuffs = [];
  let startTime = null;
  const query = `
    query PlayerAuras($code: String!, $fightID: Int!, $targetID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Buffs, fightIDs: [$fightID], targetID: $targetID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  const debuffNames = [
    'damage down', 'weakness', 'brink of death',
    '与ダメージ低下', '衰弱',
  ];
  let rawTotal = 0;
  let pageCount = 0;
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), targetID: Number(targetId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    rawTotal += rows.length;
    pageCount++;
    // 最初のページの詳細デバッグ
    if (pageCount === 1) {
      logDebug(`オーラ raw(target=${targetId}): page1=${rows.length}件`, rows.length > 0 ? {
        types: [...new Set(rows.slice(0, 50).map(e => e.type))],
        sample: rows.slice(0, 3).map(e => ({ type: e.type, name: e.ability?.name, id: e.abilityGameID, dur: e.duration }))
      } : 'empty');
    }
    for (const e of rows) {
      const type = String(e?.type || '').toLowerCase();
      if (type !== 'applybuff' && type !== 'applydebuff') continue;
      const abilityName = String(e?.ability?.name || '');
      const nameLower = abilityName.toLowerCase();
      const abilityId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const ts = Number(e?.timestamp || 0);
      const tSec = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const dur = Number(e?.duration || 0) / 1000;

      // デバフ判定（衰弱・与ダメージ低下）
      if (debuffNames.some(d => nameLower.includes(d))) {
        let kind = 'damageDown';
        if (nameLower.includes('weakness') || nameLower.includes('衰弱')) {
          kind = (nameLower.includes('brink') || nameLower.includes('強')) ? 'brink' : 'weakness';
        }
        debuffs.push({ t: tSec, duration: dur > 0 ? dur : 10, kind, name: abilityName });
        continue;
      }

      // レイドバフ判定（パーティメンバーからのシナジー）
      const buff = findBurstBuff(abilityId, abilityName);
      if (buff) {
        partyBuffs.push({ t: tSec, actionId: abilityId, action: abilityName, duration: buff.duration });
        continue;
      }
      // 自己バフ判定
      const selfBuff = findSelfBuff(abilityName);
      if (selfBuff) {
        partyBuffs.push({ t: tSec, actionId: abilityId, action: abilityName, duration: selfBuff.duration });
      }
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  logDebug(`オーラ取得(target=${targetId}): raw=${rawTotal}件 pages=${pageCount} デバフ=${debuffs.length}件 PTバフ=${partyBuffs.length}件`);
  return { debuffs, partyBuffs };
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
    logDebug('DPS table取得失敗', { error: e.message });
    return [];
  }
}
function formatJobName(jobCode) {
  if (state.lang === 'ja') return JOB_NAME_JA[jobCode] || jobCode;
  return jobCode;
}
function findBurstBuff(actionId, actionName) {
  const id = Number(actionId);
  for (const buff of BURST_BUFFS) {
    if (buff.ids.includes(id)) return buff;
  }
  const n = String(actionName || '').toLowerCase();
  for (const buff of BURST_BUFFS) {
    if (n === buff.nameEn.toLowerCase() || n === buff.nameJa) return buff;
  }
  return null;
}
function computeRollingDps(damageEvents, maxT, windowSec = 15) {
  if (!damageEvents || !damageEvents.length) return [];
  const points = [];
  for (let t = 0; t <= maxT; t += 1) {
    const windowStart = Math.max(0, t - windowSec);
    let totalDamage = 0;
    for (const d of damageEvents) {
      if (d.t >= windowStart && d.t < t) totalDamage += d.amount;
    }
    const elapsed = Math.min(t, windowSec);
    points.push({ t, dps: elapsed > 0 ? totalDamage / elapsed : 0 });
  }
  return points;
}

function detectPhases(bossCasts, fightDurationSec, lastPhase) {
  // lastPhaseが2以上ならフェーズ有りが確定
  const hasMultiPhase = lastPhase && lastPhase > 1;

  if (!bossCasts || bossCasts.length < 2) {
    if (!hasMultiPhase) return [];
    // ボス詠唱がなくてもlastPhaseから均等分割で仮フェーズ生成
    const phases = [];
    for (let i = 1; i <= lastPhase; i++) {
      phases.push({
        id: i,
        startT: (i - 1) * fightDurationSec / lastPhase,
        endT: i * fightDurationSec / lastPhase,
        label: `P${i}`,
      });
    }
    logDebug(`フェーズ: lastPhase=${lastPhase}から均等分割`, phases.map(p => p.label));
    return phases;
  }

  // ボス詠唱ギャップから検出（3秒以上で区切り）
  const minGap = 3;
  const phases = [{ id: 1, startT: 0, label: 'P1' }];
  let lastEndT = 0;
  for (const c of bossCasts) {
    if (c.t - lastEndT > minGap && lastEndT > 3) {
      phases.push({ id: phases.length + 1, startT: c.t, label: `P${phases.length + 1}` });
    }
    lastEndT = Math.max(lastEndT, c.endT || c.t);
  }
  for (let i = 0; i < phases.length; i++) {
    phases[i].endT = i < phases.length - 1 ? phases[i + 1].startT : fightDurationSec;
  }

  // lastPhaseがあってフェーズ数が合わない場合、lastPhaseを信頼
  if (hasMultiPhase && phases.length < lastPhase) {
    logDebug(`フェーズ: ギャップ検出=${phases.length}個 < lastPhase=${lastPhase} → ギャップ検出結果を使用`);
  }

  return phases.length > 1 ? phases : [];
}

function formatHitType(hitType, multistrike) {
  const isCrit = hitType === 2;
  const isDH = !!multistrike;
  if (isCrit && isDH) return 'CDH';
  if (isCrit) return 'Crit';
  if (isDH) return 'DH';
  return '';
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
function correlateDamage(timeline, damageEvents) {
  const dmgByAction = new Map();
  for (const d of damageEvents) {
    const key = d.actionId;
    if (!dmgByAction.has(key)) dmgByAction.set(key, []);
    dmgByAction.get(key).push(d);
  }
  for (const ev of timeline) {
    const candidates = dmgByAction.get(ev.actionId) || [];
    let best = null;
    let bestDist = Infinity;
    for (const d of candidates) {
      const dist = Math.abs(d.t - ev.t);
      if (dist < bestDist && dist < 3) {
        bestDist = dist;
        best = d;
      }
    }
    if (best) {
      ev.damage = best.amount;
      ev.hitType = best.hitType;
      ev.multistrike = best.multistrike;
      const idx = candidates.indexOf(best);
      if (idx !== -1) candidates.splice(idx, 1);
    }
  }
}
function filterTimelineByPhase(records) {
  if (!state.currentPhase) return records;
  const p = state.currentPhase;
  return records.filter(r => r.t >= p.startT && r.t < p.endT);
}

function renderTimeline() {
  let a = filterTimeline(state.timelineA, state.currentTab);
  let b = filterTimeline(state.timelineB, state.currentTab);
  a = filterTimelineByPhase(a);
  b = filterTimelineByPhase(b);
  let bossCasts = state.bossCastsA || [];
  if (state.currentPhase) {
    const p = state.currentPhase;
    bossCasts = bossCasts.filter(c => c.t >= p.startT && c.endT <= p.endT + 5);
  }
  const maxT = Math.max(1, ...a.map(x => x.t), ...b.map(x => x.t));
  const pxPerSec = 16 * state.zoom;
  const width = Math.max(1800, maxT * pxPerSec + 220);
  const labelA = state.selectedA?.name || 'A';
  const labelB = state.selectedB?.name || 'B';
  const jobA = state.selectedA?.job || '';
  const jobB = state.selectedB?.job || '';

  // DPSグラフの有無
  const hasDps = state.rollingDpsA.length > 0 || state.rollingDpsB.length > 0;
  const dpsGraphHeight = hasDps ? 80 : 0;
  const dpsGraphTop = hasDps ? 4 : 0;

  // Layout: DPS graph → ruler → boss track → player A → divider → player B
  const rulerTop = dpsGraphTop + dpsGraphHeight;
  const bossTrackTop = rulerTop + 18;
  const bossTrackH = 24;
  const playerAStart = bossTrackTop + bossTrackH + 12;
  const laneTop = {
    a_ogcd: playerAStart + 10,
    a_gcd: playerAStart + 64,
    a_debuff: playerAStart + 120,
    b_ogcd: 0,
    b_gcd: 0,
    b_debuff: 0,
  };
  const trackATop = playerAStart;
  const trackAHeight = 110;
  const debuffATop = laneTop.a_debuff;
  const debuffAHeight = 22;
  const dividerTop = debuffATop + debuffAHeight + 16;
  const trackBTop = dividerTop + 30;
  const trackBHeight = 110;
  laneTop.b_ogcd = trackBTop + 10;
  laneTop.b_gcd = trackBTop + 64;
  laneTop.b_debuff = trackBTop + 120;
  const debuffBTop = laneTop.b_debuff;
  const debuffBHeight = 22;
  const totalHeight = debuffBTop + debuffBHeight + 20;

  const isGcd = r => r.category === 'weaponskill' || r.category === 'spell';

  const buildDpsGraph = () => {
    if (!hasDps) return '';
    let dpsA = state.rollingDpsA;
    let dpsB = state.rollingDpsB;
    if (state.currentPhase) {
      const p = state.currentPhase;
      dpsA = dpsA.filter(d => d.t >= p.startT && d.t <= p.endT);
      dpsB = dpsB.filter(d => d.t >= p.startT && d.t <= p.endT);
    }
    if (state.currentTab === 'odd') {
      dpsA = dpsA.filter(d => Math.floor(d.t / 60) % 2 === 1);
      dpsB = dpsB.filter(d => Math.floor(d.t / 60) % 2 === 1);
    } else if (state.currentTab === 'even') {
      dpsA = dpsA.filter(d => Math.floor(d.t / 60) % 2 === 0 && d.t >= 60);
      dpsB = dpsB.filter(d => Math.floor(d.t / 60) % 2 === 0 && d.t >= 60);
    }
    const maxDps = Math.max(...dpsA.map(p => p.dps), ...dpsB.map(p => p.dps), 1);
    const gH = dpsGraphHeight - 10;
    const toPoints = (pts, color) => {
      if (!pts.length) return '';
      const coords = pts.map(p => {
        const x = 60 + p.t * pxPerSec;
        const y = dpsGraphTop + gH - (p.dps / maxDps) * (gH - 5);
        return `${x},${y}`;
      }).join(' ');
      return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />`;
    };
    // Y軸ラベル
    const labels = [];
    for (let i = 0; i <= 2; i++) {
      const dps = maxDps * i / 2;
      const y = dpsGraphTop + gH - (dps / maxDps) * (gH - 5);
      const label = dps >= 1000 ? `${(dps / 1000).toFixed(0)}k` : dps.toFixed(0);
      labels.push(`<text x="55" y="${y + 3}" text-anchor="end" fill="#64748b" font-size="9">${label}</text>`);
    }
    return `<svg class="dps-graph-svg" style="position:absolute; left:0; top:0; width:${width}px; height:${dpsGraphTop + dpsGraphHeight}px; pointer-events:none; overflow:visible;">
      <rect x="60" y="${dpsGraphTop}" width="${maxT * pxPerSec}" height="${gH}" fill="#0f172a" rx="4" opacity="0.5" />
      ${labels.join('')}
      <text x="62" y="${dpsGraphTop + 10}" fill="#38bdf8" font-size="9">${labelA}</text>
      <text x="${62 + labelA.length * 7 + 10}" y="${dpsGraphTop + 10}" fill="#f97316" font-size="9">${labelB}</text>
      ${toPoints(dpsA, '#38bdf8')}
      ${toPoints(dpsB, '#f97316')}
    </svg>`;
  };

  const buildRulerAtTop = () => {
    const marks = [];
    for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
      const x = 60 + sec * pxPerSec;
      const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
      const label = sec % 5 === 0 ? `<span>${sec}s</span>` : '';
      marks.push(`<div class="tick ${level}" style="left:${x}px; top:${rulerTop}px">${label}</div>`);
    }
    return marks.join('');
  };

  const buildBossTrack = () => {
    if (!bossCasts.length) return '';
    return bossCasts.map(c => {
      const x = 60 + c.t * pxPerSec;
      const w = Math.max(4, c.duration * pxPerSec);
      return `<div class="boss-cast" style="left:${x}px; top:${bossTrackTop}px; width:${w}px;" title="${c.t.toFixed(1)}s - ${c.endT.toFixed(1)}s ${c.name}"><span class="boss-cast-name">${c.name}</span></div>`;
    }).join('');
  };

  const buildBuffOverlays = (records, owner) => {
    const overlays = [];
    const baseTop = owner === 'a' ? trackATop : trackBTop;
    const h = owner === 'a' ? trackAHeight : trackBHeight;
    for (const r of records) {
      const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action);
      if (!buff) continue;
      const x = 60 + r.t * pxPerSec;
      const w = buff.duration * pxPerSec;
      const label = state.lang === 'ja' ? buff.nameJa : buff.nameEn;
      overlays.push(`<div class="burst-overlay" style="left:${x}px; top:${baseTop}px; width:${w}px; height:${h}px; background:${buff.color}20; border-left:2px solid ${buff.color}60;"><span class="burst-label" style="color:${buff.color}">${label}</span></div>`);
    }
    return overlays.join('');
  };

  const buildDebuffTrack = (debuffs, top) => {
    if (!debuffs || !debuffs.length) return '';
    let filtered = debuffs;
    if (state.currentPhase) {
      const p = state.currentPhase;
      filtered = debuffs.filter(d => d.t >= p.startT && d.t < p.endT);
    }
    return filtered.map(d => {
      const x = 60 + d.t * pxPerSec;
      const w = Math.max(6, d.duration * pxPerSec);
      const info = DEBUFF_IDS[d.kind] || DEBUFF_IDS.damageDown;
      const label = state.lang === 'ja' ? info.nameJa : info.nameEn;
      return `<div class="debuff-bar" style="left:${x}px; top:${top}px; width:${w}px; background:${info.color}40; border-left:2px solid ${info.color};" title="${d.t.toFixed(1)}s ${label} (${d.duration.toFixed(1)}s)"><span class="debuff-label">${label}</span></div>`;
    }).join('');
  };

  const buildPhaseLines = () => {
    if (!state.phases || state.phases.length < 2) return '';
    return state.phases.slice(1).map(phase => {
      const x = 60 + phase.startT * pxPerSec;
      return `<div class="phase-divider" style="left:${x}px; top:${rulerTop}px; height:${totalHeight - rulerTop}px">
        <span class="phase-divider-label">${phase.label}</span>
      </div>`;
    }).join('');
  };

  const buildEvents = (records, owner, partyBuffs) => {
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
      let tooltip = `${r.t.toFixed(1)}s ${r.label || r.action}`;
      if (r.damage != null && r.damage > 0) {
        tooltip += `\n${state.lang === 'ja' ? 'ダメージ' : 'Damage'}: ${r.damage.toLocaleString()}`;
        const ht = formatHitType(r.hitType, r.multistrike);
        if (ht) tooltip += ` (${ht})`;
      }
      const synergies = getActiveSynergies(r.t, records, partyBuffs);
      if (synergies.length) {
        tooltip += `\n${state.lang === 'ja' ? 'バフ' : 'Buffs'}: ${synergies.join(', ')}`;
      }
      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${tooltip}">${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${r.label || r.action}" />` : `<span>${fallback}</span>`}</div>`;
    }).join('');
  };

  el.timelineWrap.innerHTML = `
    <div class="timeline" style="width:${width}px; height:${totalHeight}px">
      ${buildDpsGraph()}
      ${buildRulerAtTop()}
      <div class="lane-label" style="top:${bossTrackTop - 2}px; font-weight:bold; color:#f87171">${t('laneBoss')}</div>
      ${buildBossTrack()}
      <div class="player-label" style="top:${playerAStart - 4}px">${labelA}${jobA ? ' (' + formatJobName(jobA) + ')' : ''}</div>
      <div class="lane-label" style="top:${laneTop.a_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track a" style="top:${trackATop}px; height:${trackAHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.a_gcd + 12}px">${t('laneGcd')}</div>
      ${buildBuffOverlays(a, 'a')}
      <div class="lane-label" style="top:${debuffATop + 4}px; color:#ef4444">${t('laneDebuff')}</div>
      ${buildDebuffTrack(state.debuffsA, debuffATop)}
      <div class="player-divider" style="top:${dividerTop}px"></div>
      <div class="player-label" style="top:${dividerTop + 10}px">${labelB}${jobB ? ' (' + formatJobName(jobB) + ')' : ''}</div>
      <div class="lane-label" style="top:${laneTop.b_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track b" style="top:${trackBTop}px; height:${trackBHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.b_gcd + 12}px">${t('laneGcd')}</div>
      ${buildBuffOverlays(b, 'b')}
      <div class="lane-label" style="top:${debuffBTop + 4}px; color:#ef4444">${t('laneDebuff')}</div>
      ${buildDebuffTrack(state.debuffsB, debuffBTop)}
      ${buildEvents(a, 'a', state.partyBuffsA)}
      ${buildEvents(b, 'b', state.partyBuffsB)}
      ${buildPhaseLines()}
    </div>
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
function renderPhaseButtons() {
  const container = el.phaseContainer;
  if (!container) return;
  container.innerHTML = '';
  if (!state.phases.length) return;
  // 「全フェーズ」ボタン
  const allBtn = document.createElement('button');
  allBtn.className = 'phase-btn' + (state.currentPhase === null ? ' active' : '');
  allBtn.textContent = t('phaseAll');
  allBtn.addEventListener('click', () => {
    state.currentPhase = null;
    renderPhaseButtons();
    renderTimeline();
  });
  container.appendChild(allBtn);
  // 各フェーズボタン
  for (const phase of state.phases) {
    const btn = document.createElement('button');
    const isActive = state.currentPhase && state.currentPhase.id === phase.id;
    btn.className = 'phase-btn' + (isActive ? ' active' : '');
    btn.textContent = phase.label;
    btn.title = `${phase.startT.toFixed(0)}s - ${phase.endT.toFixed(0)}s`;
    btn.addEventListener('click', () => {
      state.currentPhase = phase;
      renderPhaseButtons();
      renderTimeline();
    });
    container.appendChild(btn);
  }
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
  el.authStatus.textContent = t('authDisconnected');
  el.msg.textContent = t('disconnected');
});
bindClick(el.loadBtn, 'loadBtn', async () => {
  logDebug('click: load reports', {urlA: el.urlA.value, urlB: el.urlB.value});
  const parsedA = parseFFLogsUrl(el.urlA.value.trim());
  const parsedB = parseFFLogsUrl(el.urlB.value.trim());
  if (!state.token) {
    el.msg.textContent = t('needAuth');
    return;
  }
  if (!parsedA || !parsedB) {
    el.msg.textContent = t('badUrl');
    return;
  }
  el.loadBtn.disabled = true;
  el.msg.textContent = t('loading');
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
    fillFightSelect(el.fightA, fightsA, state.reportA);
    fillFightSelect(el.fightB, fightsB, state.reportB);
    el.playerA.innerHTML = '';
    el.playerB.innerHTML = '';
    el.step2.classList.remove('hidden');
    el.step3.classList.add('hidden');
    el.step4.classList.add('hidden');
    el.msg.textContent = t('killFightsLoaded')(fightsA.length, fightsB.length);
  } catch (e) {
    el.msg.textContent = `取得失敗: ${e.message}`;
  } finally {
    el.loadBtn.disabled = false;
  }
});
bindClick(el.loadPlayersBtn, 'loadPlayersBtn', async () => {
  logDebug('click: load players', {fightA: el.fightA.value, fightB: el.fightB.value});
  try {
    state.selectedFightA = Number(el.fightA.value);
    state.selectedFightB = Number(el.fightB.value);
    state.playersA = getPlayersFromFight(state.reportA, state.selectedFightA);
    state.playersB = getPlayersFromFight(state.reportB, state.selectedFightB);
    const [dpsA, dpsB] = await Promise.all([
      fetchFightDpsV2(state.urlA.reportId, state.selectedFightA),
      fetchFightDpsV2(state.urlB.reportId, state.selectedFightB),
    ]);
    state.dpsDataA = dpsA;
    state.dpsDataB = dpsB;
    const fightAObj = (state.reportA?.fights || []).find(f => Number(f.id) === state.selectedFightA);
    const fightBObj = (state.reportB?.fights || []).find(f => Number(f.id) === state.selectedFightB);
    const durA = fightAObj ? (fightAObj.endTime - fightAObj.startTime) : 1;
    const durB = fightBObj ? (fightBObj.endTime - fightBObj.startTime) : 1;
    fillPlayerSelect(el.playerA, state.playersA, dpsA, durA);
    fillPlayerSelect(el.playerB, state.playersB, dpsB, durB);
    el.step3.classList.remove('hidden');
    el.step4.classList.add('hidden');
    el.step2Message.textContent = t('playersLoaded')(state.playersA.length, state.playersB.length);
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
  state.fightA = fightA;
  state.fightB = fightB;

  // encounterIDチェック: 異なるボスの比較を防止
  if (fightA && fightB && Number(fightA.encounterID) !== Number(fightB.encounterID)) {
    el.step2Message.textContent = t('encounterMismatch');
    logDebug('encounterID不一致', { a: fightA.encounterID, b: fightB.encounterID });
    return;
  }

  el.step2Message.textContent = t('tlLoading');
  try {
    const [tlA, tlB, dmgA, dmgB, bossA, aurasA, aurasB] = await Promise.all([
      fetchPlayerTimelineV2(state.urlA.reportId, fightA, Number(state.selectedA.id), state.selectedA.job),
      fetchPlayerTimelineV2(state.urlB.reportId, fightB, Number(state.selectedB.id), state.selectedB.job),
      fetchPlayerDamageV2(state.urlA.reportId, fightA, Number(state.selectedA.id)),
      fetchPlayerDamageV2(state.urlB.reportId, fightB, Number(state.selectedB.id)),
      fetchBossCastsV2(state.urlA.reportId, fightA, state.reportA),
      fetchPlayerAurasV2(state.urlA.reportId, fightA, Number(state.selectedA.id)),
      fetchPlayerAurasV2(state.urlB.reportId, fightB, Number(state.selectedB.id)),
    ]);
    state.timelineA = deduplicateTimeline(tlA);
    state.timelineB = deduplicateTimeline(tlB);
    state.damageA = dmgA;
    state.damageB = dmgB;
    state.bossCastsA = bossA;
    state.debuffsA = aurasA.debuffs;
    state.debuffsB = aurasB.debuffs;
    state.partyBuffsA = aurasA.partyBuffs;
    state.partyBuffsB = aurasB.partyBuffs;
    correlateDamage(state.timelineA, state.damageA);
    correlateDamage(state.timelineB, state.damageB);
    logDebug(`ダメージイベント: A=${dmgA.length}件 B=${dmgB.length}件`);
    logDebug(`ボス詠唱: ${bossA.length}件 / デバフ: A=${aurasA.debuffs.length} B=${aurasB.debuffs.length} / PTバフ: A=${aurasA.partyBuffs.length} B=${aurasB.partyBuffs.length}`);

    // リアルDPS推移計算
    const maxT = Math.max(1, ...state.timelineA.map(x => x.t), ...state.timelineB.map(x => x.t));
    state.rollingDpsA = computeRollingDps(dmgA, maxT);
    state.rollingDpsB = computeRollingDps(dmgB, maxT);
    logDebug(`DPS推移計算完了: A=${state.rollingDpsA.length}点 B=${state.rollingDpsB.length}点`);

    // フェーズ検出（ボス詠唱ギャップから）
    const fightDuration = ((fightA.endTime || 0) - (fightA.startTime || 0)) / 1000;
    state.phases = detectPhases(bossA, fightDuration, fightA.lastPhase);
    state.currentPhase = null;
    if (state.phases.length) {
      logDebug(`フェーズ検出: ${state.phases.length}フェーズ`, state.phases.map(p => `${p.label}: ${p.startT.toFixed(0)}s-${p.endT.toFixed(0)}s`));
    }

    state.timelineCountA = state.timelineA.length;
    state.timelineCountB = state.timelineB.length;
    const statsA = classifyStats(state.timelineA);
    const statsB = classifyStats(state.timelineB);
    logDebug(`[A] ${state.selectedA.name}: GCD=${statsA.gcd} oGCD=${statsA.ogcd} 未分類=${statsA.unknown} / 計${statsA.total}`);
    logDebug(`[B] ${state.selectedB.name}: GCD=${statsB.gcd} oGCD=${statsB.ogcd} 未分類=${statsB.unknown} / 計${statsB.total}`);
    const iconHitA = state.timelineA.filter(e => e.icon).length;
    const iconHitB = state.timelineB.filter(e => e.icon).length;
    logDebug(`アイコン解決率: A=${iconHitA}/${statsA.total} B=${iconHitB}/${statsB.total}`);
    if (statsA.unknown > 0 || statsB.unknown > 0) {
      const unknownsA = state.timelineA.filter(e => e.category !== 'weaponskill' && e.category !== 'spell' && e.category !== 'ability').slice(0, 5);
      const unknownsB = state.timelineB.filter(e => e.category !== 'weaponskill' && e.category !== 'spell' && e.category !== 'ability').slice(0, 5);
      if (unknownsA.length) logDebug('[A] 未分類サンプル', unknownsA.map(e => `${e.action}(id:${e.actionId})`));
      if (unknownsB.length) logDebug('[B] 未分類サンプル', unknownsB.map(e => `${e.action}(id:${e.actionId})`));
    }
    el.step2Message.textContent = t('tlLoaded')(state.timelineA.length, state.timelineB.length);
  } catch (e) {
    state.timelineA = makeSampleTimeline();
    state.timelineB = makeSampleTimeline();
    state.timelineCountA = state.timelineA.length;
    state.timelineCountB = state.timelineB.length;
    state.rollingDpsA = [];
    state.rollingDpsB = [];
    state.phases = [];
    state.currentPhase = null;
    logDebug('TL取得失敗 - サンプルデータで表示', {error: e.message});
    el.step2Message.textContent = `TL取得失敗(サンプル表示): ${e.message}`;
  }
  el.step4.classList.remove('hidden');
  state.currentTab = 'all';
  el.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
  renderPhaseButtons();
  el.timelineWrap.classList.remove('hidden');
  renderTimeline();
});
bindClick(el.zoomInBtn, 'zoomInBtn', () => {
  state.zoom = Math.min(3, +(state.zoom + 0.25).toFixed(2));
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  renderTimeline();
  logDebug('zoom in', {zoom: state.zoom});
});
bindClick(el.zoomOutBtn, 'zoomOutBtn', () => {
  state.zoom = Math.max(0.5, +(state.zoom - 0.25).toFixed(2));
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  renderTimeline();
  logDebug('zoom out', {zoom: state.zoom});
});
el.tabs.forEach((tab, i) => {
  bindClick(tab, `tab-${i}`, () => {
    el.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentTab = tab.dataset.tab;
    el.timelineWrap.classList.remove('hidden');
    renderTimeline();
  });
});
function applyLang() {
  const s = I18N[state.lang];
  if (el.siteTitle) el.siteTitle.textContent = s.siteTitle;
  if (el.siteDesc) el.siteDesc.textContent = s.siteDesc;
  if (el.step1Title) el.step1Title.textContent = s.step1Title;
  if (el.connectBtn) el.connectBtn.textContent = s.connectBtn;
  if (el.disconnectBtn) el.disconnectBtn.textContent = s.disconnectBtn;
  if (el.loadBtn) el.loadBtn.textContent = s.loadBtn;
  if (el.step2Title) el.step2Title.textContent = s.step2Title;
  if (el.loadPlayersBtn) el.loadPlayersBtn.textContent = s.loadPlayersBtn;
  if (el.step3Title) el.step3Title.textContent = s.step3Title;
  if (el.compareBtn) el.compareBtn.textContent = s.compareBtn;
  if (el.step4Title) el.step4Title.textContent = s.step4Title;
  if (el.debugTitle) el.debugTitle.textContent = s.debugTitle;
  if (el.footerNote) el.footerNote.textContent = s.footerNote;
  if (el.logUrlALabel) el.logUrlALabel.firstChild.textContent = s.logUrlA + ' ';
  if (el.logUrlBLabel) el.logUrlBLabel.firstChild.textContent = s.logUrlB + ' ';
  if (el.logAFightLabel) el.logAFightLabel.firstChild.textContent = s.logAFight + '\n            ';
  if (el.logBFightLabel) el.logBFightLabel.firstChild.textContent = s.logBFight + '\n            ';
  if (el.logAPlayerLabel) el.logAPlayerLabel.firstChild.textContent = s.logAPlayer + '\n            ';
  if (el.logBPlayerLabel) el.logBPlayerLabel.firstChild.textContent = s.logBPlayer + '\n            ';
  el.tabs.forEach(tb => {
    const key = { all: 'tabAll', odd: 'tabOdd', even: 'tabEven' }[tb.dataset.tab];
    if (key) tb.textContent = s[key];
  });
  if (el.authStatus) el.authStatus.textContent = state.token ? s.authConnected : s.authDisconnected;
  if (el.langToggle) el.langToggle.textContent = state.lang === 'ja' ? 'EN' : 'JA';
  // Re-render fight selects if data exists
  if (state.reportA) {
    const fightsA = extractSelectableFights(state.reportA);
    if (fightsA.length) fillFightSelect(el.fightA, fightsA, state.reportA);
  }
  if (state.reportB) {
    const fightsB = extractSelectableFights(state.reportB);
    if (fightsB.length) fillFightSelect(el.fightB, fightsB, state.reportB);
  }
  if (state.playersA.length) {
    const fA = state.fightA || (state.reportA?.fights || []).find(f => Number(f.id) === state.selectedFightA);
    fillPlayerSelect(el.playerA, state.playersA, state.dpsDataA, fA ? (fA.endTime - fA.startTime) : 1);
  }
  if (state.playersB.length) {
    const fB = state.fightB || (state.reportB?.fights || []).find(f => Number(f.id) === state.selectedFightB);
    fillPlayerSelect(el.playerB, state.playersB, state.dpsDataB, fB ? (fB.endTime - fB.startTime) : 1);
  }
  if (!el.timelineWrap.classList.contains('hidden') && state.timelineA.length) renderTimeline();
}
bindClick(el.langToggle, 'langToggle', () => {
  state.lang = state.lang === 'ja' ? 'en' : 'ja';
  applyLang();
  logDebug('lang toggled', { lang: state.lang });
});
try {
  logDebug('script initialized');
  applyLang();
  restoreOrAuthorize().catch(e => {
    if (el.msg) el.msg.textContent = `認証初期化失敗: ${e.message}`;
    logDebug('auth init failed', { message: e.message });
  });
} catch (e) {
  if (el.msg) el.msg.textContent = `初期化失敗: ${e.message}`;
  console.error(e);
}
