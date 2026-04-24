// Phase building, selector UI, and phase-based timeline scrolling
const {
  buildFightPhasesFromFFLogs: buildFightPhasesFromFFLogsShared,
  detectPhasesFromBossCasts,
  formatPhaseLabel,
  mergePhaseSets: mergePhaseSetsShared,
} = globalThis.PhaseUtils;

function buildFightPhasesFromFFLogs(reportJson, fight, lang = 'en') {
  return buildFightPhasesFromFFLogsShared(reportJson, fight, {
    getPhaseLabel(meta, fallbackIndex) {
      return formatPhaseLabel(meta, fallbackIndex, lang);
    },
  });
}

function detectPhases(bossCasts, fightDurationSec, lastPhase) {
  return detectPhasesFromBossCasts(bossCasts, fightDurationSec, lastPhase);
}

function mergePhaseSets(phasesA, phasesB) {
  return mergePhaseSetsShared(phasesA, phasesB);
}

function scrollTimelineToPhase(phase) {
  if (!el.timelineWrap || !phase) return;
  const startTimes = [phase.a?.startT, phase.b?.startT].filter((t) => Number.isFinite(t));
  if (!startTimes.length) return;
  const startT = Math.min(...startTimes);
  const pxPerSec = 16 * state.zoom;
  const x = 60 + startT * pxPerSec;
  const viewportWidth = el.timelineWrap.clientWidth || 0;
  const left = Math.max(0, x - viewportWidth * 0.2);
  requestAnimationFrame(() => {
    el.timelineWrap.scrollTo({ left, behavior: 'smooth' });
  });
}

function renderPhaseButtons() {
  const container = el.phaseContainer;
  if (!container) return;
  container.innerHTML = '';
  if (!state.phases.length) return;

  const allBtn = document.createElement('button');
  allBtn.className = 'phase-btn' + (state.currentPhase === null ? ' active' : '');
  allBtn.textContent = t('phaseAll');
  allBtn.addEventListener('click', () => {
    state.currentPhase = null;
    renderPhaseButtons();
    renderTimeline();
    el.timelineWrap?.scrollTo({ left: 0, behavior: 'smooth' });
  });
  container.appendChild(allBtn);

  for (const phase of state.phases) {
    const btn = document.createElement('button');
    const isActive = state.currentPhase && state.currentPhase.id === phase.id;
    btn.className = 'phase-btn' + (isActive ? ' active' : '');
    btn.textContent = phase.label;
    const titleA = phase.a ? `A: ${formatTimelineTime(phase.a.startT)} - ${formatTimelineTime(phase.a.endT)}` : '';
    const titleB = phase.b ? `B: ${formatTimelineTime(phase.b.startT)} - ${formatTimelineTime(phase.b.endT)}` : '';
    btn.title = [titleA, titleB].filter(Boolean).join(' / ');
    btn.addEventListener('click', () => {
      state.currentPhase = phase;
      renderPhaseButtons();
      renderTimeline();
      scrollTimelineToPhase(phase);
    });
    container.appendChild(btn);
  }
}

Object.assign(globalThis, {
  buildFightPhasesFromFFLogs,
  detectPhases,
  mergePhaseSets,
  renderPhaseButtons,
  scrollTimelineToPhase,
});
