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
  const sharedPath = path.join(__dirname, '../scripts/ui/timeline-shared.js');
  const sourcePath = path.join(__dirname, '../scripts/ui/timeline.js');
  const sharedSource = fs.readFileSync(sharedPath, 'utf8');
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
      findSelfBuff() {
        return null;
      },
    },
    BURST_BUFFS: [],
    SELF_BUFFS: [
      { nameEn: 'Delegated Buff', nameJa: 'Delegated Buff JA', duration: 20, color: '#fff' },
    ],
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
      partyBuffsA: [],
      partyBuffsB: [],
      bossCastsA: [],
      bossCastsB: [],
      playerDebuffsA: [],
      playerDebuffsB: [],
      rollingDpsA: [],
      rollingDpsB: [],
      partyTimelineA: [
        {
          player: { id: '1', name: 'Alice', job: 'NIN' },
          records: [{ t: 8, action: 'Mug', actionId: 3, category: 'ability', label: 'Mug' }],
        },
        {
          player: { id: '3', name: 'Carol', job: 'PLD' },
          records: [{ t: 11, action: 'Fight or Flight', actionId: 5, category: 'ability', label: 'Fight or Flight' }],
        },
      ],
      partyTimelineB: [
        {
          player: { id: '2', name: 'Bob', job: 'SAM' },
          records: [{ t: 9, action: 'Meikyo Shisui', actionId: 4, category: 'ability', label: 'Meikyo Shisui' }],
        },
        {
          player: { id: '4', name: 'Dana', job: 'WHM' },
          records: [{ t: 13, action: 'Presence of Mind', actionId: 6, category: 'ability', label: 'Presence of Mind' }],
        },
      ],
      partyRollingDpsA: [{ t: 8, dps: 1000 }, { t: 10, dps: 1200 }],
      partyRollingDpsB: [{ t: 8, dps: 900 }, { t: 10, dps: 1100 }],
      partyDamageA: [{ t: 5, amount: 1000, sourceId: 1 }, { t: 20, amount: 3000, sourceId: 3 }],
      partyDamageB: [{ t: 5, amount: 1500, sourceId: 2 }, { t: 20, amount: 2500, sourceId: 4 }],
      partyTimelineFilter: 'all',
      partyTimelineCustomPlayerIdsA: [],
      partyTimelineCustomPlayerIdsB: [],
      partyTimelineCustomModalOpen: false,
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
    JOB_ROLE: {
      NIN: 'D',
      SAM: 'D',
      PLD: 'T',
      WHM: 'H',
    },
    JOB_NAME_JA: {
      NIN: '忍者',
      SAM: '侍',
      PLD: 'ナイト',
      WHM: '白魔',
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
  vm.runInContext(`${sharedSource}\n${source}\nmodule.exports = { renderTimeline, renderPartyTimeline, bindTimelineInteractions, __findSelfBuff: findSelfBuff, correlateHealing, removeKnownNonDamageFollowupCasts };`, context);

  return {
    renderTimeline: context.module.exports.renderTimeline,
    renderPartyTimeline: context.module.exports.renderPartyTimeline,
    bindTimelineInteractions: context.module.exports.bindTimelineInteractions,
    correlateHealing: context.module.exports.correlateHealing,
    findSelfBuff: context.module.exports.__findSelfBuff,
    removeKnownNonDamageFollowupCasts: context.module.exports.removeKnownNonDamageFollowupCasts,
    timelineWrap,
    context,
  };
}

describe('renderTimeline', () => {
  it('renders colored player labels and kill markers', () => {
    const { renderTimeline, timelineWrap } = loadTimelineHarness();

    renderTimeline();

    expect(timelineWrap.innerHTML).toContain('player-label player-label-a');
    expect(timelineWrap.innerHTML).toContain('player-label player-label-b');
    expect(timelineWrap.innerHTML).toContain('kill-divider a');
    expect(timelineWrap.innerHTML).toContain('kill-divider b');
  });

  it('renders synergy records for free users as compact per-action lanes with start icons', () => {
    const { renderTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.isPremium = false;
    context.state.partyBuffsA = [
      {
        t: 8,
        actionId: 34681,
        action: 'Starry Muse',
        label: 'イマジンスカイ',
        duration: 20,
        color: '#38bdf8',
        icon: '/public/job-icons/jobs/PCT/Starry_Muse.png',
        iconCandidates: ['/public/job-icons/jobs/PCT/Starry_Muse.png'],
        sourceName: 'Painter',
        sourceJob: 'PCT',
      },
      {
        t: 18,
        actionId: 7398,
        action: 'Battle Litany',
        label: 'バトルリタニー',
        duration: 20,
        color: '#60a5fa',
        icon: '/public/job-icons/jobs/DRG/Battle_Litany.png',
        iconCandidates: ['/public/job-icons/jobs/DRG/Battle_Litany.png'],
        sourceName: 'Dragoon',
        sourceJob: 'DRG',
      },
    ];

    renderTimeline();

    expect(timelineWrap.innerHTML).toContain('synergy-segment a');
    expect(timelineWrap.innerHTML).toContain('synergy-start a');
    expect(timelineWrap.innerHTML).toContain('synergy-lane-name');
    expect(timelineWrap.innerHTML).toContain('イマジンスカイ');
    expect(timelineWrap.innerHTML).toContain('バトルリタニー');
  });
});

describe('renderPartyTimeline', () => {
  it('renders compact party rows for both logs', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.isPremium = true;

    renderPartyTimeline();

    expect(timelineWrap.innerHTML).toContain('pt-group-label a');
    expect(timelineWrap.innerHTML).toContain('pt-group-label b');
    expect(timelineWrap.innerHTML).toContain('忍者 Alice');
    expect(timelineWrap.innerHTML).toContain('侍 Bob');
    expect(timelineWrap.innerHTML).toContain('ナイト Carol');
    expect(timelineWrap.innerHTML).toContain('白魔 Dana');
    expect(timelineWrap.innerHTML).toContain('pt-event');
    expect(timelineWrap.innerHTML).toContain('PT DPS');
    expect(timelineWrap.innerHTML).toContain('data-party-filter="th"');
    expect((timelineWrap.innerHTML.match(/data-party-filter="/g) || []).length).toBe(4);
    expect(timelineWrap.innerHTML).not.toContain('data-party-graph-mode');
  });

  it('shows the first 30 seconds of the personal DPS graph for free users and masks the rest', () => {
    const { renderTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.isPremium = false;
    context.state.lang = 'en';
    context.state.rollingDpsA = [{ t: 8, dps: 1000 }, { t: 40, dps: 1200 }];
    context.state.rollingDpsB = [{ t: 8, dps: 900 }, { t: 40, dps: 1100 }];

    renderTimeline();

    expect(timelineWrap.innerHTML).toContain('dps-graph-svg');
    expect(timelineWrap.innerHTML).toContain('dps-supporter-mask');
    expect(timelineWrap.innerHTML).toContain('DPS after 30s is a Supporter feature');
  });

  it('shows the first 30 seconds of the party DPS graph for free users and masks the rest', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.isPremium = false;
    context.state.lang = 'en';

    renderPartyTimeline();

    expect(timelineWrap.innerHTML).toContain('pt-dps-graph');
    expect(timelineWrap.innerHTML).toContain('dps-supporter-mask party');
    expect(timelineWrap.innerHTML).toContain('Party DPS after 30s is a Supporter feature');
  });

  it('renders boss casts and tracked player debuffs on the personal timeline', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.isPremium = true;
    context.state.bossCastsA = [{ t: 14, endT: 18, action: 'Raidwide', label: 'Raidwide', sourceName: 'Boss A' }];
    context.state.playerDebuffsA = [{ t: 20, endT: 50, action: 'Damage Down', label: 'ダメージ低下', color: '#f87171' }];

    context.module.exports.renderTimeline();

    expect(timelineWrap.innerHTML).toContain('boss-cast-bar');
    expect(timelineWrap.innerHTML).toContain('Raidwide');
    expect(timelineWrap.innerHTML).toContain('player-debuff-segment');
    expect(timelineWrap.innerHTML).toContain('ダメージ低下');
  });

  it('filters party comparison rows by tank and healer roles without deleting loaded data', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.partyTimelineFilter = 'th';

    renderPartyTimeline();

    expect(timelineWrap.innerHTML).toContain('ナイト Carol');
    expect(timelineWrap.innerHTML).toContain('白魔 Dana');
    expect(timelineWrap.innerHTML).not.toContain('忍者 Alice');
    expect(timelineWrap.innerHTML).not.toContain('侍 Bob');
    expect(context.state.partyTimelineA).toHaveLength(2);
    expect(context.state.partyTimelineB).toHaveLength(2);
  });

  it('filters party comparison rows by damage roles', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.partyTimelineFilter = 'dps';

    renderPartyTimeline();

    expect(timelineWrap.innerHTML).toContain('忍者 Alice');
    expect(timelineWrap.innerHTML).toContain('侍 Bob');
    expect(timelineWrap.innerHTML).not.toContain('ナイト Carol');
    expect(timelineWrap.innerHTML).not.toContain('白魔 Dana');
  });

  it('filters party comparison rows by custom player selections', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.partyTimelineFilter = 'custom';
    context.state.partyTimelineCustomPlayerIdsA = ['1'];
    context.state.partyTimelineCustomPlayerIdsB = ['4'];

    renderPartyTimeline();

    expect(timelineWrap.innerHTML).toContain('忍者 Alice');
    expect(timelineWrap.innerHTML).toContain('白魔 Dana');
    expect(timelineWrap.innerHTML).not.toContain('ナイト Carol');
    expect(timelineWrap.innerHTML).not.toContain('侍 Bob');
  });

  it('renders a checkbox modal for custom party comparison filtering', () => {
    const { renderPartyTimeline, timelineWrap, context } = loadTimelineHarness();
    context.state.partyTimelineCustomModalOpen = true;

    renderPartyTimeline();

    expect(timelineWrap.innerHTML).toContain('pt-custom-modal');
    expect(timelineWrap.innerHTML).toContain('カスタム絞り込み');
    expect(timelineWrap.innerHTML).toContain('data-custom-player-id="1"');
    expect(timelineWrap.innerHTML).toContain('data-custom-player-id="4"');
    expect(timelineWrap.innerHTML).not.toContain('表示するジョブ');
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

  it('does not drag or scroll the timeline when interacting with the custom filter modal', () => {
    const { bindTimelineInteractions, timelineWrap } = loadTimelineHarness();
    bindTimelineInteractions();

    const wheelHandler = timelineWrap.listeners.get('wheel');
    const pointerDownHandler = timelineWrap.listeners.get('pointerdown');
    const pointerMoveHandler = timelineWrap.listeners.get('pointermove');
    const modalTarget = {
      closest(selector) {
        return selector.includes('.pt-custom-modal') ? {} : null;
      },
    };

    let prevented = false;
    timelineWrap.scrollLeft = 120;
    wheelHandler({
      deltaX: 0,
      deltaY: 80,
      ctrlKey: false,
      target: modalTarget,
      preventDefault() {
        prevented = true;
      },
    });
    expect(prevented).toBe(false);
    expect(timelineWrap.scrollLeft).toBe(120);

    pointerDownHandler({
      button: 0,
      clientX: 200,
      pointerId: 1,
      target: modalTarget,
      preventDefault() {},
    });
    pointerMoveHandler({
      clientX: 260,
      preventDefault() {},
    });
    expect(timelineWrap.scrollLeft).toBe(120);
  });
});

describe('timeline helper delegation', () => {
  it('delegates self buff lookup to BuffUtils.findSelfBuff', () => {
    const { findSelfBuff, context } = loadTimelineHarness();
    const sentinel = { nameEn: 'Sentinel', nameJa: 'Sentinel JA', duration: 20, color: '#000' };
    const calls = [];

    context.BuffUtils.findSelfBuff = (actionName, selfBuffs) => {
      calls.push({ actionName, selfBuffs });
      return sentinel;
    };

    expect(findSelfBuff('Delegated Buff')).toBe(sentinel);
    expect(calls).toEqual([
      {
        actionName: 'Delegated Buff',
        selfBuffs: context.SELF_BUFFS,
      },
    ]);
  });
});

describe('removeKnownNonDamageFollowupCasts', () => {
  it('removes known no-damage follow-up casts after a damaging cast', () => {
    const { removeKnownNonDamageFollowupCasts } = loadTimelineHarness();
    const records = [
      { t: 10, action: 'Star Prism', label: 'スタープリズム', damage: 1000 },
      { t: 10.8, action: 'Star Prism', label: 'スタープリズム' },
      { t: 20, action: 'Quadruple Technical Finish', label: 'クワッド・テクニカルフィニッシュ', damage: 1000 },
      { t: 20.9, action: 'Quadruple Technical Finish', label: 'クワッド・テクニカルフィニッシュ' },
      { t: 30, action: 'Star Prism', label: 'スタープリズム' },
    ];

    expect(removeKnownNonDamageFollowupCasts(records)).toEqual([
      records[0],
      records[2],
      records[4],
    ]);
  });
});

describe('correlateHealing', () => {
  it('adds nearby healing totals to matching timeline events', () => {
    const { correlateHealing } = loadTimelineHarness();
    const timeline = [{ t: 10, actionId: 100, action: 'Star Prism' }];
    const healing = [
      { t: 10.1, actionId: 100, amount: 1200, overheal: 300 },
      { t: 10.2, actionId: 100, amount: 800, overheal: 0 },
      { t: 15, actionId: 100, amount: 999 },
    ];

    correlateHealing(timeline, healing);

    expect(timeline[0].healing).toBe(2000);
    expect(timeline[0].overheal).toBe(300);
  });
});
