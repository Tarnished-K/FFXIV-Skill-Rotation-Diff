const fs = require('fs');
const path = require('path');
const vm = require('vm');

const {
  buildSharedStateQuery,
  formatZoomPercent,
  parseSharedState,
} = require('../scripts/shared/app-utils');

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

function createSelect(values = []) {
  const node = createNode();
  node.options = values.map((value) => ({ value: String(value) }));
  return node;
}

function createTab(tab) {
  const node = createNode();
  node.dataset.tab = tab;
  if (tab === 'all') node.classList.add('active');
  return node;
}

function loadBootstrapHarness(search, options = {}) {
  const bootstrapPath = path.join(__dirname, '../scripts/app/bootstrap.js');
  const bootstrapSource = fs.readFileSync(bootstrapPath, 'utf8');
  const trimmedSource = bootstrapSource.replace(
    /try \{\r?\n  logDebug\('script initialized'[\s\S]*$/,
    '',
  );

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
    fightA: createSelect(['1']),
    fightB: createSelect(['2']),
    playerA: createSelect(['11']),
    playerB: createSelect(['22']),
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

  const state = {
    lang: 'en',
    currentTab: 'all',
    zoom: 2.5,
    compareError: null,
    timelineA: [],
    phases: [],
    currentPhase: null,
    playersA: [{ id: '11', name: 'Alice' }],
    playersB: [{ id: '22', name: 'Bob' }],
    tutorial: {
      active: false,
      stepIndex: 0,
      highlightKey: '',
    },
  };

  const renderCalls = [];
  const handleCompareCalls = [];

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
        href: `https://example.test/${search}`,
        search,
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
      buildSharedStateQuery,
      formatZoomPercent,
      parseSharedState,
    },
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
  vm.runInContext(`${trimmedSource}\nmodule.exports = { restoreStateFromUrl };`, context);

  const applyLangImpl = options.applyLangImpl || (() => {});

  context.__mocks = {
    renderTimeline() {
      renderCalls.push({
        tab: state.currentTab,
        phase: state.currentPhase?.id || null,
      });
    },
    applyLang() {
      applyLangImpl({ state, nodes, renderTimeline: context.__mocks.renderTimeline });
    },
    renderPhaseButtons() {},
    scrollTimelineToPhase() {},
    syncShareStateUrl() {},
    handleLoadReports: async () => true,
    handleLoadPlayers: async () => true,
    handleCompare: async (options = {}) => {
      handleCompareCalls.push(options);
      state.compareError = null;
      state.timelineA = [{ t: 12 }];
      state.phases = [{ id: '3', label: 'Phase 3' }];
      state.currentPhase = null;
      nodes.timelineWrap.classList.remove('hidden');
      if (!options.deferTimelineRender) {
        context.__mocks.renderTimeline();
      }
      return true;
    },
  };

  vm.runInContext(`
    renderTimeline = globalThis.__mocks.renderTimeline;
    applyLang = globalThis.__mocks.applyLang;
    renderPhaseButtons = globalThis.__mocks.renderPhaseButtons;
    scrollTimelineToPhase = globalThis.__mocks.scrollTimelineToPhase;
    syncShareStateUrl = globalThis.__mocks.syncShareStateUrl;
    handleLoadReports = globalThis.__mocks.handleLoadReports;
    handleLoadPlayers = globalThis.__mocks.handleLoadPlayers;
    handleCompare = globalThis.__mocks.handleCompare;
  `, context);

  return {
    restoreStateFromUrl: context.module.exports.restoreStateFromUrl,
    state,
    nodes,
    renderCalls,
    handleCompareCalls,
  };
}

describe('restoreStateFromUrl', () => {
  it('defers the initial compare render until shared tab and phase state are restored', async () => {
    const shareQuery = buildSharedStateQuery({
      reportA: 'AAA',
      reportB: 'BBB',
      fightA: '1',
      fightB: '2',
      playerA: '11',
      playerB: '22',
      phase: '3',
      tab: 'odd',
      zoom: 1.5,
      lang: 'en',
    });

    const { restoreStateFromUrl, state, nodes, renderCalls, handleCompareCalls } = loadBootstrapHarness(shareQuery);

    await restoreStateFromUrl();

    expect(handleCompareCalls).toEqual([
      { skipShareUrl: true, deferTimelineRender: true },
    ]);
    expect(renderCalls).toHaveLength(1);
    expect(renderCalls[0]).toEqual({ tab: 'odd', phase: '3' });
    expect(state.currentTab).toBe('odd');
    expect(state.currentPhase).toMatchObject({ id: '3', label: 'Phase 3' });
    expect(nodes.zoomLabel.textContent).toBe('60%');
    expect(nodes.urlA.value).toBe('https://www.fflogs.com/reports/AAA');
    expect(nodes.urlB.value).toBe('https://www.fflogs.com/reports/BBB');
  });

  it('applies language before timeline data exists, so rerender still happens only once', async () => {
    const shareQuery = buildSharedStateQuery({
      reportA: 'AAA',
      reportB: 'BBB',
      fightA: '1',
      fightB: '2',
      playerA: '11',
      playerB: '22',
      phase: '3',
      tab: 'odd',
      zoom: 1.5,
      lang: 'ja',
    });

    const applyLangCalls = [];
    const { restoreStateFromUrl, renderCalls } = loadBootstrapHarness(shareQuery, {
      applyLangImpl({ state, nodes, renderTimeline }) {
        applyLangCalls.push({
          timelineVisible: !nodes.timelineWrap.classList.contains('hidden'),
          timelineLength: state.timelineA.length,
        });
        if (!nodes.timelineWrap.classList.contains('hidden') && state.timelineA.length) {
          renderTimeline();
        }
      },
    });

    await restoreStateFromUrl();

    expect(applyLangCalls).toEqual([
      {
        timelineVisible: true,
        timelineLength: 0,
      },
    ]);
    expect(renderCalls).toHaveLength(1);
  });
});
