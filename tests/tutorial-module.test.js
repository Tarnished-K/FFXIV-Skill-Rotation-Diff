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
    style: {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getClientRects() {
      return [];
    },
    getBoundingClientRect() {
      return {
        top: 0,
        bottom: 0,
        left: 0,
        width: 100,
        height: 24,
      };
    },
    scrollIntoView() {},
    offsetWidth: 100,
    offsetHeight: 24,
  };
}

function loadTutorialModuleHarness() {
  const sourcePath = path.join(__dirname, '../scripts/app/tutorial.js');
  const source = fs.readFileSync(sourcePath, 'utf8');

  const nodes = {
    step1: createNode('step1'),
    step2: createNode('step2'),
    step3: createNode('step3'),
    step4: createNode('step4'),
    loadBtn: createNode('loadBtn'),
    loadPlayersBtn: createNode('loadPlayersBtn'),
    compareBtn: createNode('compareBtn'),
    tutorialBtn: createNode('tutorialBtn'),
    tutorialOverlay: createNode('tutorialOverlay'),
    tutorialCard: createNode('tutorialCard'),
    tutorialStepMeta: createNode('tutorialStepMeta'),
    tutorialTitle: createNode('tutorialTitle'),
    tutorialBody: createNode('tutorialBody'),
    tutorialStatus: createNode('tutorialStatus'),
    tutorialPrevBtn: createNode('tutorialPrevBtn'),
    tutorialNextBtn: createNode('tutorialNextBtn'),
    tutorialCloseBtn: createNode('tutorialCloseBtn'),
  };

  nodes.step2.classList.remove('hidden');
  nodes.step3.classList.remove('hidden');

  const storage = new Map();
  const state = {
    lang: 'en',
    reportA: { code: 'A' },
    reportB: { code: 'B' },
    playersA: [],
    playersB: [],
    timelineA: [],
    timelineB: [],
    tutorial: {
      active: true,
      stepIndex: 1,
      highlightKey: '',
    },
  };
  const el = {
    ...nodes,
  };

  const context = {
    console,
    module: { exports: {} },
    exports: {},
    state,
    el,
    I18N: {
      en: {},
      ja: {},
    },
    TUTORIAL_STATE_KEY: 'tutorial-state',
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    document: {
      getElementById(id) {
        return nodes[id] || null;
      },
      querySelectorAll(selector) {
        return selector === '.tutorial-target' ? [] : [];
      },
    },
    window: {
      innerHeight: 900,
      innerWidth: 1440,
    },
    requestAnimationFrame(callback) {
      callback();
    },
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(source, context);

  return {
    TutorialModule: context.TutorialModule,
    state,
    nodes,
    storage,
  };
}

describe('tutorial module', () => {
  it('exports tutorial helpers as a shared global module', () => {
    const { TutorialModule } = loadTutorialModuleHarness();

    expect(TutorialModule).toBeTruthy();
    expect(typeof TutorialModule.renderTutorial).toBe('function');
    expect(typeof TutorialModule.syncTutorialProgress).toBe('function');
    expect(typeof TutorialModule.startTutorial).toBe('function');
    expect(typeof TutorialModule.closeTutorial).toBe('function');
    expect(typeof TutorialModule.moveTutorial).toBe('function');
    expect(typeof TutorialModule.getTutorialCopy).toBe('function');
  });

  it('advances the guide after the reports step is already complete', () => {
    const { TutorialModule, state, nodes } = loadTutorialModuleHarness();

    TutorialModule.syncTutorialProgress();

    expect(state.tutorial.stepIndex).toBe(2);
    expect(nodes.tutorialStepMeta.textContent).toBe('Step 3 / 5');
  });
});
