// UI event wiring, language application, and bootstrap
const {
  buildSharedStateQuery,
  formatZoomPercent,
  parseSharedState,
} = globalThis.AppSharedUtils;

const {
  clearTutorialState,
  closeTutorial,
  getCurrentTutorialStep,
  getTutorialCopy,
  moveTutorial,
  positionTutorialCard,
  renderTutorial,
  syncTutorialProgress,
} = globalThis.TutorialModule;

let workflowDisableDepth = 0;

function resetComparisonData() {
  state.timelineA = [];
  state.timelineB = [];
  state.timelineCountA = 0;
  state.timelineCountB = 0;
  state.damageA = [];
  state.damageB = [];
  state.healingA = [];
  state.healingB = [];
  state.partyBuffsA = [];
  state.partyBuffsB = [];
  state.bossCastsA = [];
  state.bossCastsB = [];
  state.playerDebuffsA = [];
  state.playerDebuffsB = [];
  state.rollingDpsA = [];
  state.rollingDpsB = [];
  state.phasesA = [];
  state.phasesB = [];
  state.phases = [];
  state.currentPhase = null;
  state.timelineView = 'personal';
  state.partyTimelineCacheKey = '';
  state.partyTimelineA = [];
  state.partyTimelineB = [];
  state.partyRollingDpsA = [];
  state.partyRollingDpsB = [];
  state.partyDamageA = [];
  state.partyDamageB = [];
  state.partyTimelineFilter = 'all';
  state.partyTimelineCustomPlayerIdsA = [];
  state.partyTimelineCustomPlayerIdsB = [];
  state.partyTimelineCustomModalOpen = false;
  state.partyTimelineLoading = false;
}

function setComparisonControlsDisabled(disabled) {
  el.tabs.forEach((tab) => {
    tab.disabled = disabled;
  });
  if (el.zoomInBtn) el.zoomInBtn.disabled = disabled;
  if (el.zoomOutBtn) el.zoomOutBtn.disabled = disabled;
}

function setMcPower(pct, label) {
  const fill = document.getElementById('mcPowerFill');
  const value = document.getElementById('mcPowerValue');
  const labelEl = document.getElementById('mcPowerLabel');
  const safePct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  if (fill) fill.style.width = safePct + '%';
  if (value) value.textContent = safePct + '%';
  if (labelEl && label) labelEl.textContent = label;
}

function createMcProgressTracker(totalSteps, start = 0, end = 100) {
  const total = Math.max(1, Number(totalSteps) || 1);
  let done = 0;
  setMcPower(start, 'LOADING');
  return (label = 'LOADING') => {
    done += 1;
    const pct = start + ((end - start) * done / total);
    setMcPower(pct, label);
  };
}

function setLoadingWorkflowDisabled(disabled) {
  workflowDisableDepth = disabled ? workflowDisableDepth + 1 : Math.max(0, workflowDisableDepth - 1);
  state.isLoadingWorkflow = workflowDisableDepth > 0;
  [
    el.loadBtn,
    el.loadPlayersBtn,
    el.compareBtn,
    el.fightA,
    el.fightB,
    el.playerA,
    el.playerB,
    el.personalTimelineViewBtn,
    el.partyTimelineViewBtn,
  ].forEach((node) => {
    if (node) node.disabled = state.isLoadingWorkflow;
  });
  el.timelineViewBtns?.forEach((button) => {
    button.disabled = state.isLoadingWorkflow;
  });
  updateTimelineLayerControls();
  setComparisonControlsDisabled(state.isLoadingWorkflow);
}

function renderComparisonError() {
  if (!el.step4Message) return;
  if (!state.compareError) {
    el.step4Message.textContent = '';
    el.step4Message.classList.add('hidden');
    return;
  }
  if (state.compareError.kind === 'validation') {
    el.step4Message.textContent = state.compareError.message;
  } else {
    const formatter = t(state.compareError.kind === 'render' ? 'timelineRenderFailed' : 'compareFailed');
    el.step4Message.textContent = typeof formatter === 'function'
      ? formatter(state.compareError.message)
      : state.compareError.message;
  }
  el.step4Message.classList.remove('hidden');
}

function clearComparisonError() {
  if (el.step4) el.step4.classList.remove('has-error');
  state.compareError = null;
  renderComparisonError();
  if (!state.isLoadingWorkflow) setComparisonControlsDisabled(false);
}

function setComparisonError(kind, message) {
  state.compareError = { kind, message };
  if (el.step4) el.step4.classList.add('has-error');
  renderComparisonError();
  setComparisonControlsDisabled(true);
  if (el.phaseContainer) el.phaseContainer.innerHTML = '';
  if (el.timelineWrap) {
    el.timelineWrap.innerHTML = '';
    el.timelineWrap.classList.add('hidden');
  }
  updateBookmarkControls();
}

function buildSharedReportUrl(reportId) {
  return reportId ? `https://www.fflogs.com/reports/${reportId}` : '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getShareStateFromUrl() {
  return parseSharedState(window.location.search);
}

function setActiveTab(tab) {
  const nextTab = ['all', 'odd', 'even'].includes(tab) ? tab : 'all';
  state.currentTab = nextTab;
  el.tabs.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === nextTab);
  });
}

function setTimelineView(view) {
  const nextView = view === 'party' ? 'party' : 'personal';
  state.timelineView = nextView;
  el.timelineViewBtns?.forEach((button) => {
    button.classList.toggle('active', button.dataset.timelineView === nextView);
  });
}

function renderActiveTimelineView() {
  if (!state.timelineA.length || !state.timelineB.length || el.timelineWrap?.classList.contains('hidden')) return;
  if (state.timelineView === 'party' && state.partyTimelineA.length && state.partyTimelineB.length) renderPartyTimeline();
  else renderTimeline();
}

function updateTimelineLayerControls() {
  if (typeof t !== 'function') return;
  const labels = {
    synergy: t('layerSynergy'),
    debuff: t('layerDebuff'),
    cast: t('layerCast'),
  };
  const stateKeys = {
    synergy: 'showSynergyTimeline',
    debuff: 'showDebuffTimeline',
    cast: 'showCastTimeline',
  };
  for (const input of el.timelineLayerToggles || []) {
    const layer = input.dataset.timelineLayer;
    const key = stateKeys[layer];
    if (!key) continue;
    const label = input.closest('label')?.querySelector('[data-layer-label]');
    if (label) label.textContent = labels[layer] || layer;
    input.checked = state[key] !== false;
    const supporterOnly = layer === 'synergy' || layer === 'cast';
    const disabledByPlan = supporterOnly && !state.isPremium;
    const disabledByView = state.timelineView === 'party' && (layer === 'synergy' || layer === 'debuff');
    input.disabled = disabledByPlan || disabledByView || state.isLoadingWorkflow;
    input.title = input.disabled ? t('supporterOnlySuffix') : '';
  }
}

function setZoomLevel(zoom) {
  const numeric = Number(zoom);
  const nextZoom = Number.isFinite(numeric)
    ? Math.max(0.5, Math.min(3, +numeric.toFixed(2)))
    : state.zoom;
  state.zoom = nextZoom;
  if (el.zoomLabel) el.zoomLabel.textContent = formatZoomPercent(nextZoom);
}

function setCurrentPhaseById(phaseId) {
  if (!state.phases.length) return;
  if (phaseId === null || phaseId === undefined || phaseId === '') {
    state.currentPhase = null;
    return;
  }
  const matched = state.phases.find((phase) => String(phase.id) === String(phaseId));
  if (matched) state.currentPhase = matched;
}

function applySharedViewState(shareState, options = {}) {
  const { rerender = false } = options;
  if (shareState.lang && shareState.lang !== state.lang) {
    state.lang = shareState.lang;
    applyLang();
  }
  if (shareState.tab) setActiveTab(shareState.tab);
  if (shareState.zoom !== null && shareState.zoom !== undefined) setZoomLevel(shareState.zoom);
  if (state.phases.length) {
    setCurrentPhaseById(shareState.phase);
    renderPhaseButtons();
  }
  if (rerender && !state.compareError && !el.timelineWrap?.classList.contains('hidden') && state.timelineA.length) {
    if (state.timelineView === 'party' && state.partyTimelineA.length && state.partyTimelineB.length) {
      renderPartyTimeline();
    } else {
      renderTimeline();
    }
    if (state.currentPhase) scrollTimelineToPhase(state.currentPhase);
  }
}

function buildPartyTimelineCacheKey() {
  return [
    state.urlA?.reportId || '',
    state.urlB?.reportId || '',
    state.selectedFightA || '',
    state.selectedFightB || '',
  ].join(':');
}

async function loadPartyTimelineComparison() {
  if (!state.fightA || !state.fightB) return false;
  const cacheKey = buildPartyTimelineCacheKey();
  if (state.partyTimelineCacheKey === cacheKey && state.partyTimelineA.length && state.partyTimelineB.length) {
    return true;
  }
  state.partyTimelineLoading = true;
  if (el.step2Message) el.step2Message.textContent = t('partyTlLoading');
  try {
    const loadSide = async (reportId, fight, players) => Promise.all((players || []).map(async (player) => {
      const records = await fetchPlayerTimelineV2(reportId, fight, Number(player.id), player.job);
      return {
        player,
        records: deduplicateTimeline(records),
      };
    }));
    const [partyA, partyB, partyDamageA, partyDamageB] = await Promise.all([
      loadSide(state.urlA.reportId, state.fightA, state.playersA),
      loadSide(state.urlB.reportId, state.fightB, state.playersB),
      fetchPartyDamageV2(state.urlA.reportId, state.fightA),
      fetchPartyDamageV2(state.urlB.reportId, state.fightB),
    ]);
    state.partyTimelineA = partyA;
    state.partyTimelineB = partyB;
    state.partyDamageA = partyDamageA;
    state.partyDamageB = partyDamageB;
    const maxT = Math.max(
      1,
      Math.max(0, (Number(state.fightA?.endTime || 0) - Number(state.fightA?.startTime || 0)) / 1000),
      Math.max(0, (Number(state.fightB?.endTime || 0) - Number(state.fightB?.startTime || 0)) / 1000),
      ...partyDamageA.map((event) => event.t),
      ...partyDamageB.map((event) => event.t),
    );
    state.partyRollingDpsA = computeRollingDps(partyDamageA, maxT);
    state.partyRollingDpsB = computeRollingDps(partyDamageB, maxT);
    state.partyTimelineCacheKey = cacheKey;
    if (el.step2Message) el.step2Message.textContent = t('partyTlLoaded')(partyA.length, partyB.length);
    return true;
  } catch (error) {
    const formatter = t('partyTlLoadFailed');
    if (el.step2Message) el.step2Message.textContent = typeof formatter === 'function'
      ? formatter(error.message)
      : error.message;
    logError('PT比較TL取得エラー', { error: error.message });
    return false;
  } finally {
    state.partyTimelineLoading = false;
  }
}

async function activateTimelineView(view) {
  if (view === 'party' && !state.isPremium) {
    const url = new URL('/premium.html', window.location.origin);
    url.searchParams.set('feature', 'party-timeline');
    window.location.href = url.toString();
    setTimelineView('personal');
    if (state.timelineA.length && state.timelineB.length) renderTimeline();
    return;
  }
  setTimelineView(view);
  updateTimelineLayerControls();
  if (!state.timelineA.length || !state.timelineB.length) return;
  el.timelineWrap?.classList.remove('hidden');
  if (state.timelineView === 'party') {
    const ok = await loadPartyTimelineComparison();
    if (!ok) return;
    renderPartyTimeline();
    return;
  }
  renderTimeline();
}

function syncShareStateUrl() {
  const url = new URL(window.location.href);
  const parsedA = state.urlA || parseFFLogsUrl(el.urlA?.value?.trim?.() || '');
  const parsedB = state.urlB || parseFFLogsUrl(el.urlB?.value?.trim?.() || '');
  url.search = buildSharedStateQuery({
    reportA: parsedA?.reportId || '',
    reportB: parsedB?.reportId || '',
    fightA: state.selectedFightA || '',
    fightB: state.selectedFightB || '',
    playerA: el.playerA?.value || '',
    playerB: el.playerB?.value || '',
    phase: state.currentPhase?.id || '',
    tab: state.currentTab || 'all',
    zoom: state.zoom,
    lang: state.lang,
  });
  window.history.replaceState({}, '', url);
}

function buildCurrentBookmarkData() {
  const parsedA = state.urlA || parseFFLogsUrl(el.urlA?.value?.trim?.() || '');
  const parsedB = state.urlB || parseFFLogsUrl(el.urlB?.value?.trim?.() || '');
  const contentName = getCurrentContentName();
  const jobA = getJobLabel(state.selectedA?.job || '');
  const jobB = getJobLabel(state.selectedB?.job || '');
  const query = buildSharedStateQuery({
    reportA: parsedA?.reportId || '',
    reportB: parsedB?.reportId || '',
    fightA: state.selectedFightA || '',
    fightB: state.selectedFightB || '',
    playerA: el.playerA?.value || '',
    playerB: el.playerB?.value || '',
    phase: state.currentPhase?.id || '',
    tab: state.currentTab || 'all',
    zoom: state.zoom,
    lang: state.lang,
  });
  return {
    query,
    path: '/' + query,
    reportA: parsedA?.reportId || '',
    reportB: parsedB?.reportId || '',
    fightA: state.selectedFightA || '',
    fightB: state.selectedFightB || '',
    playerA: el.playerA?.value || '',
    playerB: el.playerB?.value || '',
    playerNameA: state.selectedA?.name || '',
    playerNameB: state.selectedB?.name || '',
    contentName,
    jobA,
    jobB,
    createdFrom: 'comparison',
  };
}

function getJobLabel(jobCode) {
  if (!jobCode) return '';
  if (typeof globalThis.formatJobName === 'function') return globalThis.formatJobName(jobCode);
  return String(jobCode);
}

function getCurrentContentName() {
  const fight = state.fightA || (state.reportA?.fights || []).find((f) => Number(f.id) === Number(state.selectedFightA));
  if (typeof globalThis.getEncounterDisplayName === 'function') {
    return globalThis.getEncounterDisplayName(state.reportA, fight) || fight?.name || '';
  }
  return fight?.name || '';
}

function buildBookmarkTitleFromData(data = {}, useCurrentFallback = false) {
  const content = data.contentName || (useCurrentFallback ? getCurrentContentName() : '');
  const a = data.playerNameA || (useCurrentFallback ? state.selectedA?.name : '') || 'A';
  const b = data.playerNameB || (useCurrentFallback ? state.selectedB?.name : '') || 'B';
  const jobA = data.jobA || (useCurrentFallback ? getJobLabel(state.selectedA?.job || '') : '');
  const jobB = data.jobB || (useCurrentFallback ? getJobLabel(state.selectedB?.job || '') : '');
  const matchup = `${a}${jobA ? ` (${jobA})` : ''} vs ${b}${jobB ? ` (${jobB})` : ''}`;
  return content ? `${content} / ${matchup}` : matchup;
}

function getBookmarkDisplayParts(bookmark) {
  const data = bookmark?.data || {};
  const autoTitle = buildBookmarkTitleFromData(data) || '比較ブックマーク';
  const rawTitle = String(bookmark?.title || autoTitle);
  const hasCustomTitle = Boolean(bookmark?.title && rawTitle !== autoTitle);
  const titleParts = rawTitle.split(' / ');
  const fallbackContent = titleParts.length > 1 ? titleParts[0] : '';
  const fallbackPlayers = titleParts.length > 1 ? titleParts.slice(1).join(' / ') : rawTitle;
  const jobA = data.jobA ? ` (${data.jobA})` : '';
  const jobB = data.jobB ? ` (${data.jobB})` : '';
  const players = data.playerNameA || data.playerNameB
    ? `${data.playerNameA || 'A'}${jobA} vs ${data.playerNameB || 'B'}${jobB}`
    : fallbackPlayers;
  return {
    title: hasCustomTitle ? rawTitle : (data.contentName || fallbackContent || rawTitle),
    content: hasCustomTitle ? (data.contentName || fallbackContent || '') : '',
    players,
  };
}

async function bookmarkFetch(input, init = {}) {
  const session = await globalThis.AuthModule?.getSession?.();
  const headers = Object.assign({}, init.headers || {});
  if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
  return fetch(input, Object.assign({}, init, { headers }));
}

function setBookmarkMessage(message) {
  if (el.bookmarkMessage) el.bookmarkMessage.textContent = message || '';
}

function showToast(message) {
  if (!el.uiToast || !message) return;
  el.uiToast.textContent = message;
  el.uiToast.classList.remove('hidden');
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    el.uiToast.classList.add('hidden');
  }, 2400);
}

function updateBookmarkControls() {
  if (!el.bookmarkControls) return;
  const hasComparison = state.timelineA.length > 0 && state.timelineB.length > 0;
  const canShow = !el.step4?.classList.contains('hidden') && (hasComparison || state.isPremium);
  el.bookmarkControls.classList.toggle('hidden', !canShow);
}

function selectHasValue(select, value) {
  if (!select || value === null || value === undefined || value === '') return false;
  return [...select.options].some((option) => option.value === String(value));
}

async function handleLoadReports(options = {}) {
  const { skipShareUrl = false } = options;
  const parsedA = parseFFLogsUrl(el.urlA.value.trim());
  const parsedB = parseFFLogsUrl(el.urlB.value.trim());
  if (!parsedA || !parsedB) {
    el.msg.textContent = t('badUrl');
    return false;
  }
  setLoadingWorkflowDisabled(true);
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
    resetComparisonData();
    clearComparisonError();
    state.selectedFightA = null;
    state.selectedFightB = null;
    state.selectedA = null;
    state.selectedB = null;
    el.step2.classList.remove('hidden');
    el.msg.textContent = t('killFightsLoaded')(fightsA.length, fightsB.length);
    sendAnalyticsEvent('reports_loaded', {
      reportCodeA: state.urlA.reportId,
      reportCodeB: state.urlB.reportId,
      fightsA: fightsA.length,
      fightsB: fightsB.length,
      zoneA: state.reportA?.zone?.name || '',
      zoneB: state.reportB?.zone?.name || '',
      sameReport: state.urlA.reportId === state.urlB.reportId,
    });
    if (!skipShareUrl) syncShareStateUrl();
    syncTutorialProgress();
    return true;
  } catch (e) {
    sendAnalyticsEvent('api_error', { stage: 'load_reports', message: e.message });
    el.msg.textContent = `取得失敗: ${e.message}`;
    return false;
  } finally {
    setLoadingWorkflowDisabled(false);
    if (state.tutorial.active) renderTutorial();
  }
}

async function handleLoadPlayers(options = {}) {
  const { skipShareUrl = false } = options;
  setLoadingWorkflowDisabled(true);
  try {
    state.selectedFightA = Number(el.fightA.value);
    state.selectedFightB = Number(el.fightB.value);
    const fightAObj = (state.reportA?.fights || []).find(f => Number(f.id) === state.selectedFightA);
    const fightBObj = (state.reportB?.fights || []).find(f => Number(f.id) === state.selectedFightB);
    if (fightAObj && fightBObj) {
      const encA = Number(fightAObj.encounterID || 0);
      const encB = Number(fightBObj.encounterID || 0);
      let mismatch = encA !== encB;
      if (!mismatch && encA === 0 && encB === 0) {
        const floorA = getSavageFloorFromName(fightAObj.name);
        const floorB = getSavageFloorFromName(fightBObj.name);
        if (floorA !== null && floorB !== null && floorA !== floorB) mismatch = true;
      }
      if (mismatch) {
        el.step2Message.textContent = t('encounterMismatch');
        return false;
      }
    }
    state.playersA = getPlayersFromFight(state.reportA, state.selectedFightA);
    state.playersB = getPlayersFromFight(state.reportB, state.selectedFightB);
    const [dpsA, dpsB] = await Promise.all([
      fetchFightDpsV2(state.urlA.reportId, state.selectedFightA),
      fetchFightDpsV2(state.urlB.reportId, state.selectedFightB),
    ]);
    state.dpsDataA = dpsA;
    state.dpsDataB = dpsB;
    const durA = fightAObj ? (fightAObj.endTime - fightAObj.startTime) : 1;
    const durB = fightBObj ? (fightBObj.endTime - fightBObj.startTime) : 1;
    fillPlayerSelect(el.playerA, state.playersA, dpsA, durA);
    fillPlayerSelect(el.playerB, state.playersB, dpsB, durB);
    resetComparisonData();
    clearComparisonError();
    state.selectedA = null;
    state.selectedB = null;
    el.step3.classList.remove('hidden');
    el.step2Message.textContent = t('playersLoaded')(state.playersA.length, state.playersB.length);
    if (!skipShareUrl) syncShareStateUrl();
    syncTutorialProgress();
    return true;
  } catch (e) {
    sendAnalyticsEvent('api_error', { stage: 'load_players', message: e.message });
    el.step2Message.textContent = `プレイヤー取得失敗: ${e.message}`;
    return false;
  } finally {
    setLoadingWorkflowDisabled(false);
    if (state.tutorial.active) renderTutorial();
  }
}

async function handleCompare(options = {}) {
  const { skipShareUrl = false, deferTimelineRender = false } = options;
  state.selectedA = state.playersA.find(p => p.id === el.playerA.value);
  state.selectedB = state.playersB.find(p => p.id === el.playerB.value);
  if (!state.selectedA || !state.selectedB) return false;
  const fightA = (state.reportA?.fights || []).find(f => Number(f.id) === Number(state.selectedFightA));
  const fightB = (state.reportB?.fights || []).find(f => Number(f.id) === Number(state.selectedFightB));
  state.fightA = fightA;
  state.fightB = fightB;
  resetComparisonData();
  clearComparisonError();
  if (!fightA || !fightB) {
    const message = '戦闘データの選択状態が更新されました。もう一度プレイヤー一覧を取得してください。';
    setComparisonError('validation', message);
    el.step4.classList.remove('hidden');
    renderComparisonError();
    return false;
  }
  if (fightA && fightB && Number(fightA.encounterID) !== Number(fightB.encounterID)) {
    const message = t('encounterMismatch');
    setComparisonError('validation', message);
    logError('encounterID不一致のため比較を中止', { a: fightA.encounterID, b: fightB.encounterID });
    sendAnalyticsEvent('api_error', {
      stage: 'compare',
      kind: 'validation',
      reason: 'encounter_mismatch',
      encounterA: Number(fightA.encounterID || 0),
      encounterB: Number(fightB.encounterID || 0),
      message,
    });
    el.step4.classList.remove('hidden');
    setActiveTab('all');
    renderPhaseButtons();
    renderComparisonError();
    if (!skipShareUrl) syncShareStateUrl();
    syncTutorialProgress();
    return false;
  }
  if (fightA && fightB && Number(fightA.encounterID) === 0 && Number(fightB.encounterID) === 0) {
    const floorA = getSavageFloorFromName(fightA.name);
    const floorB = getSavageFloorFromName(fightB.name);
    if (floorA !== null && floorB !== null && floorA !== floorB) {
      const message = t('encounterMismatch');
      setComparisonError('validation', message);
      logError('ボス名フロア不一致のため比較を中止', { nameA: fightA.name, nameB: fightB.name, floorA, floorB });
      sendAnalyticsEvent('api_error', {
        stage: 'compare',
        kind: 'validation',
        reason: 'floor_mismatch',
        encounterA: 0,
        encounterB: 0,
        message,
      });
      el.step4.classList.remove('hidden');
      setActiveTab('all');
      renderPhaseButtons();
      renderComparisonError();
      if (!skipShareUrl) syncShareStateUrl();
      syncTutorialProgress();
      return false;
    }
  }

  el.step2Message.textContent = t('tlLoading');
  try {
    const markProgress = createMcProgressTracker(12, 8, 90);
    const tracked = (promise, label) => promise.finally(() => markProgress(label));
    const [tlA, tlB, dmgA, dmgB, healA, healB, synergiesA, synergiesB, bossCastsA, bossCastsB, debuffsA, debuffsB] = await Promise.all([
      tracked(fetchPlayerTimelineV2(state.urlA.reportId, fightA, Number(state.selectedA.id), state.selectedA.job), 'TIMELINE A'),
      tracked(fetchPlayerTimelineV2(state.urlB.reportId, fightB, Number(state.selectedB.id), state.selectedB.job), 'TIMELINE B'),
      tracked(fetchPlayerDamageV2(state.urlA.reportId, fightA, Number(state.selectedA.id)), 'DAMAGE A'),
      tracked(fetchPlayerDamageV2(state.urlB.reportId, fightB, Number(state.selectedB.id)), 'DAMAGE B'),
      tracked(fetchPlayerHealingV2(state.urlA.reportId, fightA, Number(state.selectedA.id)), 'HEALING A'),
      tracked(fetchPlayerHealingV2(state.urlB.reportId, fightB, Number(state.selectedB.id)), 'HEALING B'),
      tracked(fetchPartySynergyCastsV2(state.urlA.reportId, fightA, state.playersA, Number(state.selectedA.id)), 'BUFFS A'),
      tracked(fetchPartySynergyCastsV2(state.urlB.reportId, fightB, state.playersB, Number(state.selectedB.id)), 'BUFFS B'),
      tracked(fetchBossCastsV2(state.urlA.reportId, fightA, state.reportA), 'BOSS A'),
      tracked(fetchBossCastsV2(state.urlB.reportId, fightB, state.reportB), 'BOSS B'),
      tracked(fetchPlayerDebuffsV2(state.urlA.reportId, fightA, Number(state.selectedA.id)), 'DEBUFFS A'),
      tracked(fetchPlayerDebuffsV2(state.urlB.reportId, fightB, Number(state.selectedB.id)), 'DEBUFFS B'),
    ]);
    state.timelineA = deduplicateTimeline(tlA);
    state.timelineB = deduplicateTimeline(tlB);
    state.damageA = dmgA;
    state.damageB = dmgB;
    state.healingA = healA;
    state.healingB = healB;
    state.partyBuffsA = synergiesA;
    state.partyBuffsB = synergiesB;
    state.bossCastsA = bossCastsA;
    state.bossCastsB = bossCastsB;
    state.playerDebuffsA = debuffsA;
    state.playerDebuffsB = debuffsB;
    correlateDamage(state.timelineA, state.damageA);
    correlateDamage(state.timelineB, state.damageB);
    correlateHealing(state.timelineA, state.healingA);
    correlateHealing(state.timelineB, state.healingB);
    state.timelineA = removeKnownNonDamageFollowupCasts(state.timelineA);
    state.timelineB = removeKnownNonDamageFollowupCasts(state.timelineB);
    logDebug(`ダメージイベント: A=${dmgA.length}件 B=${dmgB.length}件`);
    logDebug(`ヒールイベント: A=${healA.length}件 B=${healB.length}件`);
    logDebug(`PTシナジー: A=${synergiesA.length} B=${synergiesB.length}`);
    logDebug(`ボス詠唱: A=${bossCastsA.length} B=${bossCastsB.length}`);
    logDebug(`プレイヤーデバフ: A=${debuffsA.length} B=${debuffsB.length}`);

    const maxT = Math.max(1, ...state.timelineA.map(x => x.t), ...state.timelineB.map(x => x.t));
    state.rollingDpsA = computeRollingDps(dmgA, maxT);
    state.rollingDpsB = computeRollingDps(dmgB, maxT);
    logDebug(`DPS推移計算完了: A=${state.rollingDpsA.length}点 B=${state.rollingDpsB.length}点`);

    const fightDurationA = ((fightA.endTime || 0) - (fightA.startTime || 0)) / 1000;
    const fightDurationB = ((fightB.endTime || 0) - (fightB.startTime || 0)) / 1000;
    const canShowPhaseSelector =
      Number(fightA.encounterID) === Number(fightB.encounterID) &&
      shouldShowUltimatePhaseSelector(state.reportA, fightA) &&
      shouldShowUltimatePhaseSelector(state.reportB, fightB);
    const officialPhasesA = canShowPhaseSelector ? buildFightPhasesFromFFLogs(state.reportA, fightA, state.lang) : [];
    const officialPhasesB = canShowPhaseSelector ? buildFightPhasesFromFFLogs(state.reportB, fightB, state.lang) : [];
    if (officialPhasesA.length) logDebug('FF Logs phases A', officialPhasesA.map(p => `${p.label}: ${p.startT.toFixed(1)}s-${p.endT.toFixed(1)}s`));
    if (officialPhasesB.length) logDebug('FF Logs phases B', officialPhasesB.map(p => `${p.label}: ${p.startT.toFixed(1)}s-${p.endT.toFixed(1)}s`));
    const phaseResultA = canShowPhaseSelector && !officialPhasesA.length
      ? detectPhases([], fightDurationA, fightA.lastPhase)
      : null;
    const phaseResultB = canShowPhaseSelector && !officialPhasesB.length
      ? detectPhases([], fightDurationB, fightB.lastPhase)
      : null;
    if (phaseResultA?.usedFallbackSplit && phaseResultA.phases.length) {
      logDebug(`phase fallback split from lastPhase=${fightA.lastPhase}`, phaseResultA.phases.map((phase) => phase.label));
    }
    if (phaseResultB?.usedFallbackSplit && phaseResultB.phases.length) {
      logDebug(`phase fallback split from lastPhase=${fightB.lastPhase}`, phaseResultB.phases.map((phase) => phase.label));
    }
    if (phaseResultA?.incompleteLastPhase) {
      logDebug(
        `phase estimate incomplete: ${phaseResultA.phases.length} < lastPhase=${fightA.lastPhase}`,
        phaseResultA.boundaryTimes.map((time) => `${time.toFixed(1)}s`),
      );
    }
    if (phaseResultB?.incompleteLastPhase) {
      logDebug(
        `phase estimate incomplete: ${phaseResultB.phases.length} < lastPhase=${fightB.lastPhase}`,
        phaseResultB.boundaryTimes.map((time) => `${time.toFixed(1)}s`),
      );
    }
    state.phasesA = officialPhasesA.length ? officialPhasesA : (phaseResultA?.phases || []);
    state.phasesB = officialPhasesB.length ? officialPhasesB : (phaseResultB?.phases || []);
    state.phases = canShowPhaseSelector ? mergePhaseSets(state.phasesA, state.phasesB) : [];
    state.currentPhase = null;
    const phaseSourceA = officialPhasesA.length ? 'fflogs' : (phaseResultA?.phases?.length ? 'fallback' : 'none');
    const phaseSourceB = officialPhasesB.length ? 'fflogs' : (phaseResultB?.phases?.length ? 'fallback' : 'none');
    if (state.phases.length) {
      logDebug(`フェーズ検出A: ${state.phasesA.length}フェーズ`, state.phasesA.map(p => `${p.label}: ${p.startT.toFixed(0)}s-${p.endT.toFixed(0)}s`));
      logDebug(`フェーズ検出B: ${state.phasesB.length}フェーズ`, state.phasesB.map(p => `${p.label}: ${p.startT.toFixed(0)}s-${p.endT.toFixed(0)}s`));
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
    el.step2Message.textContent = '';
    sendAnalyticsEvent('comparison_completed', {
      reportCodeA: state.urlA?.reportId || '',
      reportCodeB: state.urlB?.reportId || '',
      fightIdA: Number(fightA?.id || 0),
      fightIdB: Number(fightB?.id || 0),
      encounterA: Number(fightA?.encounterID || 0),
      encounterB: Number(fightB?.encounterID || 0),
      jobA: state.selectedA?.job || '',
      jobB: state.selectedB?.job || '',
      timelineCountA: state.timelineA.length,
      timelineCountB: state.timelineB.length,
      phasesShown: state.phases.length,
      phaseSourceA,
      phaseSourceB,
      usedPhaseSelector: canShowPhaseSelector,
    });
  } catch (e) {
    sendAnalyticsEvent('api_error', { stage: 'compare', message: e.message });
    resetComparisonData();
    setComparisonError('compare', e.message);
    logError('TL取得失敗', {error: e.message});
    el.step2Message.textContent = t('compareFailed')(e.message);
  }
  el.step4.classList.remove('hidden');
  setMcPower(state.compareError ? 0 : 100, state.compareError ? 'ERROR' : 'COMPLETE');
  setActiveTab('all');
  setTimelineView('personal');
  renderPhaseButtons();
  renderComparisonError();
  if (!state.compareError) {
    el.timelineWrap.classList.remove('hidden');
    if (!deferTimelineRender) {
      try {
        renderTimeline();
      } catch (renderErr) {
        setComparisonError('render', renderErr.message);
        sendAnalyticsEvent('api_error', { stage: 'render', message: renderErr.message });
        logError('renderTimeline エラー', { error: renderErr.message, stack: renderErr.stack?.split('\n').slice(0, 3).join(' | ') });
        el.step2Message.textContent = t('timelineRenderFailed')(renderErr.message);
      }
    }
  }
  updateBookmarkControls();
  if (!skipShareUrl) syncShareStateUrl();
  syncTutorialProgress();
  return !state.compareError;
}

async function saveCurrentBookmark() {
  if (!state.isPremium) {
    window.location.href = '/premium.html?feature=bookmarks';
    return;
  }
  if (!state.timelineA.length || !state.timelineB.length) {
    setBookmarkMessage(t('bookmarkSaveFirst'));
    showToast(t('bookmarkSaveFirst'));
    return;
  }
  if (el.saveBookmarkBtn) el.saveBookmarkBtn.disabled = true;
  try {
    const bookmarkData = buildCurrentBookmarkData();
    const automaticTitle = buildBookmarkTitleFromData(bookmarkData, true);
    const inputTitle = typeof window.prompt === 'function'
      ? window.prompt(t('bookmarkNamePrompt'), automaticTitle)
      : automaticTitle;
    if (inputTitle === null) return;
    const title = String(inputTitle || '').trim() || automaticTitle;
    const res = await bookmarkFetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        data: bookmarkData,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 403) {
      window.location.href = '/premium.html?feature=bookmarks';
      return;
    }
    if (res.status === 409) {
      setBookmarkMessage(t('bookmarkLimitReached'));
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || t('bookmarkSaveFailed'));
    }
    setBookmarkMessage('');
    showToast(t('bookmarkSaved'));
  } catch (error) {
    setBookmarkMessage(error.message || t('bookmarkSaveFailed'));
  } finally {
    if (el.saveBookmarkBtn) el.saveBookmarkBtn.disabled = false;
  }
}

function openBookmarkModal() {
  if (!el.bookmarkModal) return;
  el.bookmarkModal.classList.remove('hidden');
  el.bookmarkModal.setAttribute('aria-hidden', 'false');
}

function closeBookmarkModal() {
  if (!el.bookmarkModal) return;
  el.bookmarkModal.classList.add('hidden');
  el.bookmarkModal.setAttribute('aria-hidden', 'true');
}

function renderBookmarkList(bookmarks) {
  if (!el.bookmarkList) return;
  if (!bookmarks.length) {
    el.bookmarkList.innerHTML = '<p class="submessage">' + escapeHtml(t('bookmarkEmpty')) + '</p>';
    return;
  }
  el.bookmarkList.innerHTML = bookmarks.map((bookmark) => {
    const display = getBookmarkDisplayParts(bookmark);
    const created = bookmark.created_at ? new Date(bookmark.created_at).toLocaleString(state.lang === 'ja' ? 'ja-JP' : 'en-US') : '';
    const href = bookmark.data?.path || ('/' + (bookmark.data?.query || ''));
    return `
      <div class="bookmark-item" data-bookmark-id="${bookmark.id}">
        <div class="bookmark-item-meta">
          <strong>${escapeHtml(display.title)}</strong>
          ${display.content ? `<span class="bookmark-content">${escapeHtml(t('bookmarkContent') + display.content)}</span>` : ''}
          <span class="bookmark-players">${escapeHtml(display.players)}</span>
          <span>${escapeHtml(t('bookmarkSavedAt') + created)}</span>
        </div>
        <div class="bookmark-item-actions">
          <a class="button-link ghost bookmark-open-link" href="${escapeHtml(href)}">${escapeHtml(t('bookmarkOpen'))}</a>
          <button type="button" class="bookmark-edit-btn" data-edit-bookmark="${bookmark.id}" data-bookmark-title="${escapeHtml(bookmark.title || display.title)}">${escapeHtml(t('bookmarkEdit'))}</button>
          <button type="button" class="bookmark-delete-btn" data-delete-bookmark="${bookmark.id}">${escapeHtml(t('bookmarkDelete'))}</button>
        </div>
      </div>
    `;
  }).join('');
}

async function loadBookmarks() {
  if (!state.isPremium) {
    window.location.href = '/premium.html?feature=bookmarks';
    return;
  }
  openBookmarkModal();
  setBookmarkMessage(t('bookmarkLoading'));
  if (el.bookmarkList) el.bookmarkList.innerHTML = '';
  try {
    const res = await bookmarkFetch('/api/bookmarks');
    const data = await res.json().catch(() => null);
    if (res.status === 403) {
      closeBookmarkModal();
      window.location.href = '/premium.html?feature=bookmarks';
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || t('bookmarkListFailed'));
    }
    renderBookmarkList(data.bookmarks || []);
    setBookmarkMessage('');
  } catch (error) {
    setBookmarkMessage(error.message || t('bookmarkListFailed'));
  }
}

async function renameBookmark(id, currentTitle = '') {
  if (!id) return;
  const nextTitle = typeof window.prompt === 'function'
    ? window.prompt(t('bookmarkRenamePrompt'), currentTitle)
    : currentTitle;
  if (nextTitle === null) return;
  const title = String(nextTitle || '').trim();
  if (!title) return;
  setBookmarkMessage(t('bookmarkLoading'));
  try {
    const res = await bookmarkFetch('/api/bookmarks?id=' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || t('bookmarkRenameFailed'));
    }
    await loadBookmarks();
    showToast(t('bookmarkRenamed'));
  } catch (error) {
    setBookmarkMessage(error.message || t('bookmarkRenameFailed'));
  }
}

async function deleteBookmark(id) {
  if (!id) return;
  setBookmarkMessage(t('bookmarkDeleting'));
  try {
    const res = await bookmarkFetch('/api/bookmarks?id=' + encodeURIComponent(id), { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || t('bookmarkDeleteFailed'));
    }
    await loadBookmarks();
    showToast(t('bookmarkDeleted'));
  } catch (error) {
    setBookmarkMessage(error.message || t('bookmarkDeleteFailed'));
  }
}

async function checkUsageBeforeCompare() {
  const session = await globalThis.AuthModule?.getSession?.();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
  const res = await fetch('/api/check-usage', {
    method: 'POST',
    headers,
    body: '{}',
  });
  const data = await res.json().catch(() => null);
  if (res.status === 429) {
    const message = t('usageLimitReached');
    if (el.step2Message) el.step2Message.textContent = message;
    globalThis.AuthUIModule?.updateMothercrystalLimitStatus?.(data || { remaining: 0 });
    setMcPower(0, 'LIMIT');
    return { ok: false, limited: true, data };
  }
  if (!res.ok || !data?.ok) {
    const message = data?.error || t('usageCheckFailed');
    if (el.step2Message) el.step2Message.textContent = message;
    return { ok: false, data };
  }
  const user = session?.user || null;
  globalThis.AuthUIModule?.renderHeaderAuth?.(user, data);
  return { ok: true, data };
}

async function restoreStateFromUrl() {
  const shareState = getShareStateFromUrl();
  applySharedViewState(shareState);
  if (!shareState.reportA || !shareState.reportB) return;
  setLoadingWorkflowDisabled(true);
  try {
    el.urlA.value = buildSharedReportUrl(shareState.reportA);
    el.urlB.value = buildSharedReportUrl(shareState.reportB);
    logDebug('restoring share state', shareState);
    const reportsLoaded = await handleLoadReports({ skipShareUrl: true });
    if (!reportsLoaded) {
      syncShareStateUrl();
      return;
    }
    if (selectHasValue(el.fightA, shareState.fightA)) el.fightA.value = shareState.fightA;
    if (selectHasValue(el.fightB, shareState.fightB)) el.fightB.value = shareState.fightB;
    if (!selectHasValue(el.fightA, shareState.fightA) || !selectHasValue(el.fightB, shareState.fightB)) {
      syncShareStateUrl();
      return;
    }
    const playersLoaded = await handleLoadPlayers({ skipShareUrl: true });
    if (!playersLoaded) {
      syncShareStateUrl();
      return;
    }
    if (selectHasValue(el.playerA, shareState.playerA)) el.playerA.value = shareState.playerA;
    if (selectHasValue(el.playerB, shareState.playerB)) el.playerB.value = shareState.playerB;
    if (selectHasValue(el.playerA, shareState.playerA) && selectHasValue(el.playerB, shareState.playerB)) {
      await handleCompare({ skipShareUrl: true, deferTimelineRender: true });
    }
    applySharedViewState(shareState, { rerender: true });
    syncShareStateUrl();
  } finally {
    setLoadingWorkflowDisabled(false);
  }
}

bindClick(el.tutorialBtn, 'tutorialBtn', () => {
  logDebug('click: tutorial page');
  clearTutorialState();
  state.tutorial.active = false;
  state.tutorial.stepIndex = 0;
  window.location.href = '/tutorial.html';
});
bindClick(el.tutorialCloseBtn, 'tutorialCloseBtn', () => {
  logDebug('click: tutorial close');
  closeTutorial();
});
bindClick(el.tutorialPrevBtn, 'tutorialPrevBtn', () => {
  moveTutorial(-1);
});
bindClick(el.tutorialNextBtn, 'tutorialNextBtn', () => {
  moveTutorial(1);
});
window.addEventListener('resize', () => {
  if (state.tutorial.active) renderTutorial();
});
window.addEventListener('scroll', () => {
  if (state.tutorial.active) positionTutorialCard(getCurrentTutorialStep().step?.getTarget?.());
}, true);

bindClick(el.loadBtn, 'loadBtn', async () => {
  logDebug('click: load reports', {urlA: el.urlA.value, urlB: el.urlB.value});
  await handleLoadReports();
});
bindClick(el.loadPlayersBtn, 'loadPlayersBtn', async () => {
  logDebug('click: load players', {fightA: el.fightA.value, fightB: el.fightB.value});
  await handleLoadPlayers();
});
bindClick(el.compareBtn, 'compareBtn', async () => {
  logDebug('click: compare', {playerA: el.playerA.value, playerB: el.playerB.value});
  setLoadingWorkflowDisabled(true);
  setMcPower(0, 'CHECKING');
  try {
    const usage = await checkUsageBeforeCompare();
    if (!usage.ok) return;
    setMcPower(8, 'LOADING');
    await handleCompare();
  } finally {
    setLoadingWorkflowDisabled(false);
  }
});
bindClick(el.saveBookmarkBtn, 'saveBookmarkBtn', saveCurrentBookmark);
bindClick(el.showBookmarksBtn, 'showBookmarksBtn', loadBookmarks);
bindClick(el.bookmarkModalCloseBtn, 'bookmarkModalCloseBtn', closeBookmarkModal);
bindClick(el.bookmarkModalBackdrop, 'bookmarkModalBackdrop', closeBookmarkModal);
el.bookmarkList?.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-bookmark]');
  if (editButton) {
    renameBookmark(editButton.getAttribute('data-edit-bookmark'), editButton.getAttribute('data-bookmark-title') || '');
    return;
  }
  const deleteButton = event.target.closest('[data-delete-bookmark]');
  if (deleteButton) {
    deleteBookmark(deleteButton.getAttribute('data-delete-bookmark'));
  }
});
el.playerA?.addEventListener('change', syncShareStateUrl);
el.playerB?.addEventListener('change', syncShareStateUrl);
el.fightA?.addEventListener('change', () => {
  if (!el.step3.classList.contains('hidden')) {
    el.step3.classList.add('hidden');
    el.playerA.innerHTML = '';
    el.playerB.innerHTML = '';
    resetComparisonData();
    clearComparisonError();
    el.step2Message.textContent = '';
  }
  syncShareStateUrl();
});
el.fightB?.addEventListener('change', () => {
  if (!el.step3.classList.contains('hidden')) {
    el.step3.classList.add('hidden');
    el.playerA.innerHTML = '';
    el.playerB.innerHTML = '';
    resetComparisonData();
    clearComparisonError();
    el.step2Message.textContent = '';
  }
  syncShareStateUrl();
});
el.phaseContainer?.addEventListener('click', (event) => {
  if (event.target.closest('.phase-btn')) syncShareStateUrl();
});
bindClick(el.zoomInBtn, 'zoomInBtn', () => {
  setZoomLevel(state.zoom + 0.25);
  if (state.timelineView === 'party' && state.partyTimelineA.length && state.partyTimelineB.length) renderPartyTimeline();
  else renderTimeline();
  syncShareStateUrl();
  logDebug('zoom in', {zoom: state.zoom});
});
bindClick(el.zoomOutBtn, 'zoomOutBtn', () => {
  setZoomLevel(state.zoom - 0.25);
  if (state.timelineView === 'party' && state.partyTimelineA.length && state.partyTimelineB.length) renderPartyTimeline();
  else renderTimeline();
  syncShareStateUrl();
  logDebug('zoom out', {zoom: state.zoom});
});
el.tabs.forEach((tab, i) => {
  bindClick(tab, `tab-${i}`, () => {
    setActiveTab(tab.dataset.tab);
    el.timelineWrap.classList.remove('hidden');
    if (state.timelineView === 'party' && state.partyTimelineA.length && state.partyTimelineB.length) renderPartyTimeline();
    else renderTimeline();
    scrollTimelineToTabFocus();
    syncShareStateUrl();
  });
});
el.timelineViewBtns?.forEach((button, i) => {
  bindClick(button, `timeline-view-${i}`, () => {
    activateTimelineView(button.dataset.timelineView);
  });
});
el.timelineLayerToggles?.forEach((input, i) => {
  input.closest('label')?.addEventListener('click', (event) => {
    const layer = input.dataset.timelineLayer;
    const supporterOnly = layer === 'synergy' || layer === 'cast';
    if (supporterOnly && !state.isPremium) {
      event.preventDefault();
      const url = new URL('/premium.html', window.location.origin);
      url.searchParams.set('feature', `${layer}-timeline`);
      window.location.href = url.toString();
    }
  });
  input.addEventListener('change', async () => {
    const layer = input.dataset.timelineLayer;
    const stateKeys = {
      synergy: 'showSynergyTimeline',
      debuff: 'showDebuffTimeline',
      cast: 'showCastTimeline',
    };
    const key = stateKeys[layer];
    if (!key) return;
    const supporterOnly = layer === 'synergy' || layer === 'cast';
    if (input.checked && supporterOnly && !state.isPremium) {
      input.checked = false;
      const url = new URL('/premium.html', window.location.origin);
      url.searchParams.set('feature', `${layer}-timeline`);
      window.location.href = url.toString();
      updateTimelineLayerControls();
      return;
    }
    state[key] = input.checked;
    updateTimelineLayerControls();
    renderActiveTimelineView();
    logDebug('timeline layer toggle', { layer, enabled: input.checked });
  });
});
function applyLang() {
  const s = I18N[state.lang];
  const tutorialCopy = getTutorialCopy();
  if (el.siteTitle) el.siteTitle.textContent = s.siteTitle;
  if (el.siteDesc) el.siteDesc.textContent = s.siteDesc;
  if (el.step1Title) el.step1Title.textContent = s.step1Title;
  if (el.publicOnlyNote) el.publicOnlyNote.textContent = s.publicOnlyNote;
  if (el.loadBtn) el.loadBtn.textContent = s.loadBtn;
  if (el.step2Title) el.step2Title.textContent = s.step2Title;
  if (el.loadPlayersBtn) el.loadPlayersBtn.textContent = s.loadPlayersBtn;
  if (el.step3Title) el.step3Title.textContent = s.step3Title;
  if (el.compareBtn) el.compareBtn.textContent = s.compareBtn;
  if (el.step4Title) el.step4Title.textContent = s.step4Title;
  if (el.personalTimelineViewBtn) el.personalTimelineViewBtn.textContent = s.personalTimelineView;
  if (el.partyTimelineViewBtn) el.partyTimelineViewBtn.textContent = s.partyTimelineView;
  if (el.debugNormalTitle) el.debugNormalTitle.textContent = s.debugNormalTitle;
  if (el.debugErrorTitle) el.debugErrorTitle.textContent = s.debugErrorTitle;
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
  if (el.tutorialBtn) {
    el.tutorialBtn.textContent = tutorialCopy.launch;
    el.tutorialBtn.href = state.lang === 'en' ? '/tutorial.html?lang=en' : '/tutorial.html';
  }
  if (el.contactBtn) {
    el.contactBtn.textContent = s.contactBtn;
    el.contactBtn.href = state.lang === 'en' ? '/contact.html?lang=en' : '/contact.html';
  }
  if (el.privacyLink) {
    el.privacyLink.href = state.lang === 'en' ? '/privacy.html?lang=en' : '/privacy.html';
  }
  if (el.langToggle) el.langToggle.textContent = state.lang === 'ja' ? 'EN' : 'JA';
  // Sidebar nav items
  const navHomeEl = document.getElementById('navHome');
  if (navHomeEl) navHomeEl.textContent = s.navHome || 'ホーム';
  const navGuideEl = document.getElementById('navGuide');
  if (navGuideEl) navGuideEl.textContent = s.navGuide || '初めての方はこちら';
  const navLangEl = document.getElementById('navLang');
  if (navLangEl) navLangEl.textContent = s.navLang || '言語切り替え';
  const navLoadEl = document.getElementById('navLoad');
  if (navLoadEl) navLoadEl.textContent = s.navRequest || s.contactBtn || 'ご要望フォーム';
  const navRankingEl = document.getElementById('navRanking');
  if (navRankingEl) navRankingEl.textContent = s.navRanking || 'ランキング';
  const navRankingDamageEl = document.getElementById('navRankingDamage');
  if (navRankingDamageEl) navRankingDamageEl.textContent = s.navRankingDamage || 'ダメージランキング';
  const navRankingSpeedEl = document.getElementById('navRankingSpeed');
  if (navRankingSpeedEl) navRankingSpeedEl.textContent = s.navRankingSpeed || 'スピードランキング';
  // Sidebar data section labels
  const sidebarDataSourceLabelEl = document.getElementById('sidebarDataSourceLabel');
  if (sidebarDataSourceLabelEl) sidebarDataSourceLabelEl.textContent = s.sidebarDataSourceLabel || 'ユーザー名';
  const sidebarMemberStatusLabelEl = document.getElementById('sidebarMemberStatusLabel');
  if (sidebarMemberStatusLabelEl) sidebarMemberStatusLabelEl.textContent = s.sidebarMemberStatusLabel || '会員ステータス';
  const sidebarRemainingLabelEl = document.getElementById('sidebarRemainingLabel');
  if (sidebarRemainingLabelEl) sidebarRemainingLabelEl.textContent = s.sidebarRemainingLabel || '本日の残り回数';
  updateTimelineLayerControls();
  if (el.saveBookmarkBtn) el.saveBookmarkBtn.textContent = s.bookmarkSave;
  if (el.showBookmarksBtn) el.showBookmarksBtn.textContent = s.bookmarkList;
  if (el.bookmarkModalTitle) el.bookmarkModalTitle.textContent = s.bookmarkModalTitle;
  globalThis.AuthUIModule?.refreshAuthUI?.();
  if (el.bookmarkModal && !el.bookmarkModal.classList.contains('hidden')) {
    loadBookmarks();
  }
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
  renderComparisonError();
  if (!el.timelineWrap.classList.contains('hidden') && state.timelineA.length) {
    if (state.timelineView === 'party' && state.partyTimelineA.length && state.partyTimelineB.length) renderPartyTimeline();
    else renderTimeline();
  }
  if (state.tutorial.active) renderTutorial();
}
bindClick(el.langToggle, 'langToggle', () => {
  state.lang = state.lang === 'ja' ? 'en' : 'ja';
  applyLang();
  syncShareStateUrl();
  sendAnalyticsEvent('lang_changed', { lang: state.lang });
  logDebug('lang toggled', { lang: state.lang });
});
try {
  logDebug('script initialized');
  sendAnalyticsEvent('page_view', { lang: state.lang });
  clearTutorialState();
  state.tutorial.active = false;
  state.tutorial.stepIndex = 0;
  applyLang();
  Promise.resolve()
    .then(() => restoreStateFromUrl())
    .catch((error) => {
      logError('URL state restore failed', { error: error.message });
    });
} catch (e) {
  if (el.msg) el.msg.textContent = `初期化失敗: ${e.message}`;
  console.error(e);
}

globalThis.updateBookmarkControls = updateBookmarkControls;
globalThis.updateTimelineLayerControls = updateTimelineLayerControls;

globalThis.__exportPremiumPreview = async function () {
  const MAX_SEC = 300;
  if (!state.selectedA || !state.selectedB) {
    alert('比較結果が見つかりません。先に比較を実行してください。');
    return;
  }

  if (!state.partyTimelineA.length || !state.partyTimelineB.length) {
    console.log('[__exportPremiumPreview] PTタイムラインを取得中...');
    await loadPartyTimelineComparison();
  }

  function getDps(dpsData, playerName) {
    const entry = (dpsData || []).find(e => e.name === playerName);
    return entry?.aDPS ? Math.round(entry.aDPS) : 0;
  }

  function buildParty(partyTimeline, dpsData) {
    return (partyTimeline || []).map(row => ({
      name: row.player?.name || '',
      job: row.player?.job || '',
      dps: getDps(dpsData, row.player?.name || ''),
      timeline: (row.records || [])
        .filter(e => e.t <= MAX_SEC)
        .map(e => ({ t: e.t, castEndT: e.castEndT ?? null, action: e.action || '', label: e.label || '', icon: e.icon || '', category: e.category || '' })),
    }));
  }

  const fightDurA = (state.fightA?.endTime || 0) - (state.fightA?.startTime || 0);
  const fightDurB = (state.fightB?.endTime || 0) - (state.fightB?.startTime || 0);

  const data = {
    reportCode: state.urlA?.reportId || '',
    fightId: state.fightA?.id || 0,
    encounter: state.fightA?.name || '',
    previewMaxSec: MAX_SEC,
    players: [
      {
        name: state.selectedA.name,
        job: state.selectedA.job,
        dps: getDps(state.dpsDataA, state.selectedA.name) ||
          (state.damageA?.length && fightDurA > 0
            ? Math.round(state.damageA.reduce((s, e) => s + (e.amount || 0), 0) / (fightDurA / 1000))
            : 0),
        timeline: (state.timelineA || [])
          .filter(e => e.t <= MAX_SEC)
          .map(e => ({ t: e.t, castEndT: e.castEndT ?? null, action: e.action || '', label: e.label || '', icon: e.icon || '', category: e.category || '' })),
      },
      {
        name: state.selectedB.name,
        job: state.selectedB.job,
        dps: getDps(state.dpsDataB, state.selectedB.name) ||
          (state.damageB?.length && fightDurB > 0
            ? Math.round(state.damageB.reduce((s, e) => s + (e.amount || 0), 0) / (fightDurB / 1000))
            : 0),
        timeline: (state.timelineB || [])
          .filter(e => e.t <= MAX_SEC)
          .map(e => ({ t: e.t, castEndT: e.castEndT ?? null, action: e.action || '', label: e.label || '', icon: e.icon || '', category: e.category || '' })),
      },
    ],
    bossCasts: (state.bossCastsA || [])
      .filter(e => e.t <= MAX_SEC)
      .map(e => ({
        t: e.t,
        endT: e.endT ?? e.t + 3,
        action: e.action || '',
        actionJa: e.actionJa || e.action || '',
        isBoss: !!e.isBoss,
        sourceName: e.sourceName || '',
      })),
    synergy: (state.partyBuffsA || [])
      .filter(e => e.t <= MAX_SEC)
      .map(e => ({
        t: e.t,
        duration: e.duration || 20,
        nameEn: e.nameEn || '',
        nameJa: e.nameJa || e.nameEn || '',
        color: e.color || '#888',
        sourceName: e.sourceName || '',
      })),
    partyA: buildParty(state.partyTimelineA, state.dpsDataA),
    partyB: buildParty(state.partyTimelineB, state.dpsDataB),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'premium-preview-data.json';
  a.click();
  URL.revokeObjectURL(url);
  console.log('[__exportPremiumPreview] ダウンロード完了', {
    players: data.players.map(p => `${p.name} (${p.job}): ${p.dps} DPS, ${p.timeline.length}件`),
    bossCasts: data.bossCasts.length,
    synergy: data.synergy.length,
  });
};

globalThis.__captureTimelineHTML = function (type = 'personal') {
  const wrap = document.querySelector('.timeline-wrap');
  if (!wrap) { alert('タイムラインが表示されていません。比較を実行してから再試行してください。'); return; }
  const FILE_MAP = {
    'personal':      'premium-preview-timeline.html',
    'party':         'premium-preview-party.html',
    'personal-odd':  'premium-preview-personal-odd.html',
    'personal-even': 'premium-preview-personal-even.html',
    'party-odd':     'premium-preview-party-odd.html',
    'party-even':    'premium-preview-party-even.html',
  };
  const filename = FILE_MAP[type] || `premium-preview-${type}.html`;
  const html = wrap.outerHTML;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  console.log(`[__captureTimelineHTML] ダウンロード完了 - assets/${filename} に保存してください`);
  console.log('利用可能なtype: personal / party / personal-odd / personal-even / party-odd / party-even');
};
