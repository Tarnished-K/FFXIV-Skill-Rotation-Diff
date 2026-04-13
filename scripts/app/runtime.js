// Core constants, state, DOM bindings, and debug helpers

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
