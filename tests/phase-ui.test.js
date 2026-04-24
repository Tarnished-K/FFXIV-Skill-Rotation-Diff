const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createButtonNode() {
  const listeners = new Map();
  return {
    className: '',
    textContent: '',
    title: '',
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    click() {
      const handler = listeners.get('click');
      if (handler) handler();
    },
  };
}

function loadPhaseUiHarness() {
  const sourcePath = path.join(__dirname, '../scripts/ui/phase-ui.js');
  const source = fs.readFileSync(sourcePath, 'utf8');

  const createdButtons = [];
  const phaseContainer = {
    innerHTML: '',
    children: [],
    appendChild(node) {
      this.children.push(node);
    },
  };
  const timelineWrap = {
    clientWidth: 400,
    scrollCalls: [],
    scrollTo(options) {
      this.scrollCalls.push(options);
    },
  };

  const context = {
    console,
    module: { exports: {} },
    exports: {},
    globalThis: null,
    requestAnimationFrame(callback) {
      callback();
    },
    PhaseUtils: {
      buildFightPhasesFromFFLogs() {
        return [];
      },
      detectPhasesFromBossCasts() {
        return { phases: [] };
      },
      formatPhaseLabel(meta) {
        return meta?.name || '';
      },
      mergePhaseSets(phasesA) {
        return phasesA || [];
      },
    },
    formatTimelineTime(seconds) {
      return `${seconds}s`;
    },
    state: {
      zoom: 2,
      currentPhase: null,
      phases: [
        {
          id: 'p1',
          label: 'P1',
          a: { startT: 10, endT: 20 },
          b: { startT: 12, endT: 22 },
        },
      ],
    },
    el: {
      phaseContainer,
      timelineWrap,
    },
    t(key) {
      return key === 'phaseAll' ? 'All Phases' : key;
    },
    renderTimelineCalls: 0,
    renderTimeline() {
      context.renderTimelineCalls += 1;
    },
    document: {
      createElement() {
        const node = createButtonNode();
        createdButtons.push(node);
        return node;
      },
    },
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(`${source}\nmodule.exports = { renderPhaseButtons, scrollTimelineToPhase };`, context);

  return {
    renderPhaseButtons: context.module.exports.renderPhaseButtons,
    scrollTimelineToPhase: context.module.exports.scrollTimelineToPhase,
    createdButtons,
    phaseContainer,
    timelineWrap,
    context,
  };
}

describe('scrollTimelineToPhase', () => {
  it('scrolls to the earliest available phase start', () => {
    const { scrollTimelineToPhase, timelineWrap } = loadPhaseUiHarness();

    scrollTimelineToPhase({
      a: { startT: 20 },
      b: { startT: 15 },
    });

    expect(timelineWrap.scrollCalls).toEqual([
      { left: 460, behavior: 'smooth' },
    ]);
  });
});

describe('renderPhaseButtons', () => {
  it('renders all/phase buttons and clicking a phase updates state and scrolls', () => {
    const { renderPhaseButtons, phaseContainer, timelineWrap, context } = loadPhaseUiHarness();

    renderPhaseButtons();

    expect(phaseContainer.children).toHaveLength(2);
    expect(phaseContainer.children[0].textContent).toBe('All Phases');
    expect(phaseContainer.children[1].textContent).toBe('P1');

    phaseContainer.children[1].click();

    expect(context.state.currentPhase).toEqual(context.state.phases[0]);
    expect(context.renderTimelineCalls).toBe(1);
    expect(timelineWrap.scrollCalls.at(-1)).toEqual({
      left: 300,
      behavior: 'smooth',
    });
  });

  it('clicking the all button clears the phase and scrolls back to zero', () => {
    const { renderPhaseButtons, phaseContainer, timelineWrap, context } = loadPhaseUiHarness();
    context.state.currentPhase = context.state.phases[0];

    renderPhaseButtons();
    phaseContainer.children[0].click();

    expect(context.state.currentPhase).toBeNull();
    expect(context.renderTimelineCalls).toBe(1);
    expect(timelineWrap.scrollCalls.at(-1)).toEqual({
      left: 0,
      behavior: 'smooth',
    });
  });
});
