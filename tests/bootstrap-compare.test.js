const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createClassList(initial = []) {
  const classes = new Set(initial.filter(Boolean));
  return {
    add(...names) {
      names.forEach((name) => classes.add(name));
    },
    remove(...names) {
      names.forEach((name) => classes.delete(name));
    },
    contains(name) {
      return classes.has(name);
    },
    toggle(name, force) {
      if (force === undefined) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      }
      if (force) classes.add(name);
      else classes.delete(name);
      return !!force;
    },
  };
}

function createNode(id = '') {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    dataset: {},
    classList: createClassList(),
    addEventListener() {},
    removeEventListener() {},
    getClientRects() {
      return [];
    },
    getBoundingClientRect() {
      return {
        top: 0,
        bottom: 0,
        left: 0,
        width: 100,
        height: 20,
      };
    },
    offsetWidth: 100,
    offsetHeight: 20,
    scrollTop: 0,
    scrollHeight: 0,
  };
}

function createTab(tab) {
  const node = createNode();
  node.dataset.tab = tab;
  return node;
}

function trimBootstrapSource() {
  const bootstrapPath = path.join(__dirname, '../scripts/app/bootstrap.js');
  const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf8');
  return bootstrapSource.replace(
    /try \{\r?\n  logDebug\('script initialized'[\s\S]*$/,
    '',
  );
}

function loadCompareHarness(options = {}) {
  const source = trimBootstrapSource();
  const tabs = ['all', 'odd', 'even'].map(createTab);
  const nodes = {
    tutorialBtn: createNode('tutorialBtn'),
    tutorialCloseBtn: createNode('tutorialCloseBtn'),
    tutorialPrevBtn: createNode('tutorialPrevBtn'),
    tutorialNextBtn: createNode('tutorialNextBtn'),
    loadBtn: createNode('loadBtn'),
    loadPlayersBtn: createNode('loadPlayersBtn'),
    compareBtn: createNode('compareBtn'),
    zoomInBtn: createNode('zoomInBtn'),
    zoomOutBtn: createNode('zoomOutBtn'),
    langToggle: createNode('langToggle'),
    urlA: createNode('urlA'),
    urlB: createNode('urlB'),
    fightA: createNode('fightA'),
    fightB: createNode('fightB'),
    playerA: createNode('playerA'),
    playerB: createNode('playerB'),
    step2: createNode('step2'),
    step3: createNode('step3'),
    step4: createNode('step4'),
    step1Message: createNode('step1Message'),
    step2Message: createNode('step2Message'),
    step4Message: createNode('step4Message'),
    timelineWrap: createNode('timelineWrap'),
    zoomLabel: createNode('zoomLabel'),
    phaseContainer: createNode('phaseContainer'),
    debugLog: createNode('debugLog'),
    errorLog: createNode('errorLog'),
    tutorialOverlay: createNode('tutorialOverlay'),
    tutorialBackdrop: createNode('tutorialBackdrop'),
    tutorialCard: createNode('tutorialCard'),
    tutorialStepMeta: createNode('tutorialStepMeta'),
    tutorialTitle: createNode('tutorialTitle'),
    tutorialBody: createNode('tutorialBody'),
    tutorialStatus: createNode('tutorialStatus'),
    publicOnlyNote: createNode('publicOnlyNote'),
    siteTitle: createNode('siteTitle'),
    siteDesc: createNode('siteDesc'),
    step1Title: createNode('step1Title'),
    step2Title: createNode('step2Title'),
    step3Title: createNode('step3Title'),
    step4Title: createNode('step4Title'),
    debugNormalTitle: createNode('debugNormalTitle'),
    debugErrorTitle: createNode('debugErrorTitle'),
    footerNote: createNode('footerNote'),
    logUrlALabel: createNode('logUrlALabel'),
    logUrlBLabel: createNode('logUrlBLabel'),
    logAFightLabel: createNode('logAFightLabel'),
    logBFightLabel: createNode('logBFightLabel'),
    logAPlayerLabel: createNode('logAPlayerLabel'),
    logBPlayerLabel: createNode('logBPlayerLabel'),
  };
  nodes.playerA.value = '11';
  nodes.playerB.value = '22';
  nodes.timelineWrap.classList.add('hidden');

  const fightsA = options.fightsA || [{ id: 1, encounterID: 1, name: 'Fight A', startTime: 0, endTime: 30000, lastPhase: 1 }];
  const fightsB = options.fightsB || [{ id: 2, encounterID: 1, name: 'Fight B', startTime: 0, endTime: 30000, lastPhase: 1 }];

  const state = {
    lang: 'en',
    currentTab: 'odd',
    zoom: 1,
    compareError: null,
    timelineA: [],
    timelineB: [],
    rollingDpsA: [],
    rollingDpsB: [],
    damageA: [],
    damageB: [],
    partyBuffsA: [],
    partyBuffsB: [],
    phases: [],
    phasesA: [],
    phasesB: [],
    currentPhase: null,
    playersA: [{ id: '11', name: 'Alice', job: 'NIN' }],
    playersB: [{ id: '22', name: 'Bob', job: 'SAM' }],
    reportA: { fights: fightsA },
    reportB: { fights: fightsB },
    selectedFightA: 1,
    selectedFightB: 2,
    selectedA: null,
    selectedB: null,
    urlA: { reportId: 'AAA' },
    urlB: { reportId: 'BBB' },
    tutorial: {
      active: false,
      stepIndex: 0,
      highlightKey: '',
    },
  };

  const analyticsEvents = [];
  const setActiveTabCalls = [];

  const context = {
    console,
    URL,
    URLSearchParams,
    Promise,
    setTimeout,
    clearTimeout,
    module: { exports: {} },
    exports: {},
    state,
    el: {
      ...nodes,
      msg: nodes.step1Message,
      tabs,
    },
    bindClick() {},
    logDebug() {},
    logError() {},
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    window: {
      location: {
        href: 'https://example.test/',
        search: '',
      },
      history: {
        replaceState() {},
      },
      addEventListener() {},
      innerHeight: 1080,
      innerWidth: 1920,
    },
    document: {
      getElementById(id) {
        return nodes[id] || null;
      },
      querySelectorAll(selector) {
        return selector === '.tab' ? tabs : [];
      },
    },
    AppSharedUtils: {
      buildSharedStateQuery() {
        return '';
      },
      formatZoomPercent() {
        return '';
      },
      parseSharedState() {
        return {};
      },
    },
    I18N: {
      en: {},
      ja: {},
    },
    TUTORIAL_STATE_KEY: 'tutorial',
    TutorialModule: {
      clearTutorialState() {},
      closeTutorial() {},
      getCurrentTutorialStep() {
        return { step: null };
      },
      getTutorialCopy() {
        return { launch: 'First time here?' };
      },
      moveTutorial() {},
      positionTutorialCard() {},
      renderTutorial() {},
      syncTutorialProgress() {},
    },
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(`${source}\nmodule.exports = { handleCompare };`, context);

  context.__mocks = {
    setActiveTab(tab) {
      setActiveTabCalls.push(tab);
      state.currentTab = tab;
      tabs.forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
      });
    },
    sendAnalyticsEvent(eventName, payload) {
      analyticsEvents.push({ eventName, payload });
    },
    t(key) {
      const values = {
        encounterMismatch: 'Encounter mismatch',
        tlLoading: 'Loading timeline',
        compareFailed: (message) => `Compare failed: ${message}`,
        timelineRenderFailed: (message) => `Render failed: ${message}`,
      };
      return values[key] || key;
    },
    resetComparisonData() {
      state.timelineA = [];
      state.timelineB = [];
      state.damageA = [];
      state.damageB = [];
      state.partyBuffsA = [];
      state.partyBuffsB = [];
      state.rollingDpsA = [];
      state.rollingDpsB = [];
      state.phases = [];
      state.phasesA = [];
      state.phasesB = [];
      state.currentPhase = null;
    },
    clearComparisonError() {
      state.compareError = null;
    },
    setComparisonError(kind, message) {
      state.compareError = { kind, message };
    },
    renderPhaseButtons() {},
    renderComparisonError() {},
    syncShareStateUrl() {},
    renderTimeline() {},
    getSavageFloorFromName(name) {
      return (options.floorByName || {})[name] ?? null;
    },
    fetchPlayerTimelineV2: async () => ([{ t: 10, action: 'Slice', actionId: 1, category: 'ability' }]),
    fetchPlayerDamageV2: async () => ([{ t: 10, amount: 100 }]),
    fetchPlayerAurasV2: async () => ([]),
    deduplicateTimeline: (timeline) => timeline,
    correlateDamage() {},
    computeRollingDps() {
      return [];
    },
    shouldShowUltimatePhaseSelector() {
      return false;
    },
    buildFightPhasesFromFFLogs() {
      return [];
    },
    detectPhases() {
      return { phases: [] };
    },
    mergePhaseSets() {
      return [];
    },
    classifyStats() {
      return { gcd: 0, ogcd: 0, unknown: 0, total: 0 };
    },
  };

  vm.runInContext(`
    setActiveTab = globalThis.__mocks.setActiveTab;
    sendAnalyticsEvent = globalThis.__mocks.sendAnalyticsEvent;
    t = globalThis.__mocks.t;
    resetComparisonData = globalThis.__mocks.resetComparisonData;
    clearComparisonError = globalThis.__mocks.clearComparisonError;
    setComparisonError = globalThis.__mocks.setComparisonError;
    renderPhaseButtons = globalThis.__mocks.renderPhaseButtons;
    renderComparisonError = globalThis.__mocks.renderComparisonError;
    syncShareStateUrl = globalThis.__mocks.syncShareStateUrl;
    renderTimeline = globalThis.__mocks.renderTimeline;
    getSavageFloorFromName = globalThis.__mocks.getSavageFloorFromName;
    fetchPlayerTimelineV2 = globalThis.__mocks.fetchPlayerTimelineV2;
    fetchPlayerDamageV2 = globalThis.__mocks.fetchPlayerDamageV2;
    fetchPlayerAurasV2 = globalThis.__mocks.fetchPlayerAurasV2;
    deduplicateTimeline = globalThis.__mocks.deduplicateTimeline;
    correlateDamage = globalThis.__mocks.correlateDamage;
    computeRollingDps = globalThis.__mocks.computeRollingDps;
    shouldShowUltimatePhaseSelector = globalThis.__mocks.shouldShowUltimatePhaseSelector;
    buildFightPhasesFromFFLogs = globalThis.__mocks.buildFightPhasesFromFFLogs;
    detectPhases = globalThis.__mocks.detectPhases;
    mergePhaseSets = globalThis.__mocks.mergePhaseSets;
    classifyStats = globalThis.__mocks.classifyStats;
  `, context);

  return {
    handleCompare: context.module.exports.handleCompare,
    state,
    nodes,
    tabs,
    analyticsEvents,
    setActiveTabCalls,
  };
}

describe('handleCompare tab activation', () => {
  it('uses setActiveTab when encounter ids mismatch', async () => {
    const harness = loadCompareHarness({
      fightsA: [{ id: 1, encounterID: 1, name: 'Fight A', startTime: 0, endTime: 30000, lastPhase: 1 }],
      fightsB: [{ id: 2, encounterID: 2, name: 'Fight B', startTime: 0, endTime: 30000, lastPhase: 1 }],
    });

    await harness.handleCompare({ skipShareUrl: true });

    expect(harness.setActiveTabCalls).toEqual(['all']);
  });

  it('uses setActiveTab when zero-encounter savage floors mismatch', async () => {
    const harness = loadCompareHarness({
      fightsA: [{ id: 1, encounterID: 0, name: 'P1S', startTime: 0, endTime: 30000, lastPhase: 1 }],
      fightsB: [{ id: 2, encounterID: 0, name: 'P2S', startTime: 0, endTime: 30000, lastPhase: 1 }],
      floorByName: {
        P1S: 1,
        P2S: 2,
      },
    });

    await harness.handleCompare({ skipShareUrl: true });

    expect(harness.setActiveTabCalls).toEqual(['all']);
  });

  it('uses setActiveTab after a successful compare', async () => {
    const harness = loadCompareHarness();

    await harness.handleCompare({ skipShareUrl: true, deferTimelineRender: true });

    expect(harness.setActiveTabCalls).toEqual(['all']);
  });
});
