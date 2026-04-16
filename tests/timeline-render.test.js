const fs = require('fs');
const path = require('path');
const vm = require('vm');

const timelineUtils = require('../scripts/shared/timeline-utils');

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

function createTimelineWrap() {
  const listeners = new Map();
  return {
    innerHTML: '',
    scrollLeft: 120,
    clientWidth: 640,
    dataset: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    querySelectorAll() {
      return [];
    },
    scrollTo({ left }) {
      this.scrollLeft = left;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    get listeners() {
      return listeners;
    },
  };
}

function loadTimelineHarness() {
  const sourcePath = path.join(__dirname, '../scripts/ui/timeline.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const timelineWrap = createTimelineWrap();

  const context = {
    console,
    module: { exports: {} },
    exports: {},
    globalThis: null,
    requestAnimationFrame(callback) {
      callback();
    },
    AppSharedUtils: {
      computeRollingDps() {
        return [];
      },
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
    TimelineUtils: timelineUtils,
    BuffUtils: {
      getActiveSynergies() {
        return [];
      },
    },
    BURST_BUFFS: [],
    SELF_BUFFS: [],
    DEBUFF_IDS: {
      generic: { nameEn: 'Debuff', nameJa: 'デバフ', color: '#ef4444' },
    },
    state: {
      lang: 'ja',
      zoom: 2.5,
      currentTab: 'all',
      currentPhase: null,
      timelineA: [
        { t: 10, action: 'Spinning Edge', actionId: 1, category: 'weaponskill', label: 'Spinning Edge' },
      ],
      timelineB: [
        { t: 12, action: 'Gust Slash', actionId: 2, category: 'weaponskill', label: 'Gust Slash' },
      ],
      bossCastsA: [
        { t: 20, endT: 24, duration: 4, name: 'Ultimate Attack', sourceId: 99, sourceName: 'Boss' },
      ],
      debuffsA: [
        { t: 15, duration: 6, kind: 'generic', name: 'Magic Vulnerability Up' },
      ],
      debuffsB: [
        { t: 18, duration: 8, kind: 'generic', name: 'Bleed' },
      ],
      partyBuffsA: [],
      partyBuffsB: [],
      rollingDpsA: [],
      rollingDpsB: [],
      selectedA: { name: 'Player A', job: 'NIN' },
      selectedB: { name: 'Player B', job: 'SAM' },
      fightA: { startTime: 0, endTime: 30000 },
      fightB: { startTime: 0, endTime: 36000 },
      phases: [],
    },
    el: {
      timelineWrap,
    },
    normalizeJobCode() {
      return 'UNK';
    },
    JOB_ROLE: {},
    JOB_NAME_JA: {
      NIN: '忍者',
      SAM: '侍',
    },
    t(key) {
      return {
        laneBoss: 'Boss Cast',
        laneAbility: 'Ability',
        laneGcd: 'WS / Spell',
        laneDebuff: 'Debuff',
      }[key] || key;
    },
    logDebug() {},
    document: {
      createElement() {
        return {
          textContent: '',
        };
      },
    },
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(`${source}\nmodule.exports = { renderTimeline, bindTimelineInteractions };`, context);

  return {
    renderTimeline: context.module.exports.renderTimeline,
    bindTimelineInteractions: context.module.exports.bindTimelineInteractions,
    timelineWrap,
  };
}

describe('renderTimeline', () => {
  it('renders colored player labels, boss casts, debuffs, and kill markers', () => {
    const { renderTimeline, timelineWrap } = loadTimelineHarness();

    renderTimeline();

    expect(timelineWrap.innerHTML).toContain('player-label player-label-a');
    expect(timelineWrap.innerHTML).toContain('player-label player-label-b');
    expect(timelineWrap.innerHTML).toContain('boss-cast');
    expect(timelineWrap.innerHTML).toContain('debuff-bar');
    expect(timelineWrap.innerHTML).toContain('kill-divider a');
    expect(timelineWrap.innerHTML).toContain('kill-divider b');
  });
});

describe('bindTimelineInteractions', () => {
  it('adds wheel and drag handlers that move the timeline horizontally', () => {
    const { bindTimelineInteractions, timelineWrap } = loadTimelineHarness();
    bindTimelineInteractions();

    const wheelHandler = timelineWrap.listeners.get('wheel');
    const pointerDownHandler = timelineWrap.listeners.get('pointerdown');
    const pointerMoveHandler = timelineWrap.listeners.get('pointermove');
    const pointerUpHandler = timelineWrap.listeners.get('pointerup');

    expect(typeof wheelHandler).toBe('function');
    expect(typeof pointerDownHandler).toBe('function');
    expect(typeof pointerMoveHandler).toBe('function');
    expect(typeof pointerUpHandler).toBe('function');

    let prevented = false;
    wheelHandler({
      deltaX: 0,
      deltaY: 40,
      ctrlKey: false,
      preventDefault() {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);
    expect(timelineWrap.scrollLeft).toBe(160);

    pointerDownHandler({
      button: 0,
      clientX: 200,
      pointerId: 1,
      target: { closest: () => null },
      preventDefault() {},
    });
    pointerMoveHandler({
      clientX: 150,
      preventDefault() {},
    });
    expect(timelineWrap.scrollLeft).toBe(210);

    pointerUpHandler({ pointerId: 1 });
    expect(timelineWrap.classList.contains('is-dragging')).toBe(false);
  });
});
