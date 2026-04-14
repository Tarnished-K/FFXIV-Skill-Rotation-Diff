// UI event wiring, language application, and bootstrap

function getTutorialCopy() {
  if (state.lang === 'ja') {
    return {
      launch: '初めての方はこちら',
      prev: '戻る',
      next: '次へ',
      finish: '完了',
      close: '閉じる',
      waiting: 'この操作が完了するまで待機しています。',
      ready: '完了しました。次の手順へ進めます。',
      step: (current, total) => `手順 ${current} / ${total}`,
      introTitle: 'クイックスタート',
      introBody: 'このガイドでは、2つのログを読み込んで比較タイムラインを表示するところまでを順番に案内します。',
      connectTitle: '1. FFLogs と連携する',
      connectBody: 'まずこのボタンから FFLogs に接続します。認証後にこのページへ戻ると、ガイドは自動で続行されます。',
      loadReportsTitle: '2. ログ URL を入力して読み込む',
      loadReportsBody: 'A と B に FFLogs の URL を1つずつ入力し、レポートを読み込みます。戦闘選択が表示されたら完了です。',
      loadPlayersTitle: '3. 戦闘を選んでプレイヤー一覧を取得する',
      loadPlayersBody: '比較したい戦闘を A / B それぞれで選び、プレイヤー一覧を取得してください。',
      compareTitle: '4. プレイヤーを選んで比較する',
      compareBody: '各ログから1人ずつ選び、比較を開始します。タイムラインが表示されたらセットアップ完了です。',
      doneTitle: 'ガイド完了',
      doneBody: '比較表示まで完了しました。ここからはタブ切替、フェーズ選択、ズーム、ログ確認が自由に行えます。',
    };
  }
  return {
    launch: 'First time here?',
    prev: 'Back',
    next: 'Next',
    finish: 'Done',
    close: 'Close',
    waiting: 'Waiting for this step to be completed.',
    ready: 'Completed. Move to the next step.',
    step: (current, total) => `Step ${current} / ${total}`,
    introTitle: 'Quick Start Guide',
    introBody: 'This guide walks you through the minimum steps needed to load two logs and reach the comparison timeline.',
    connectTitle: '1. Connect to FFLogs',
    connectBody: 'Use this button to sign in to FFLogs first. After the authorization flow returns to this page, the guide will continue automatically.',
    loadReportsTitle: '2. Enter two log URLs and load them',
    loadReportsBody: 'Paste one FFLogs report URL into A and one into B, then load the reports. When the fight selectors appear, this step is complete.',
    loadPlayersTitle: '3. Choose fights and load players',
    loadPlayersBody: 'Pick the fight you want to compare from each log, then load the player list for both sides.',
    compareTitle: '4. Choose players and start comparison',
    compareBody: 'Select one player from each log and run the comparison. When the timeline panel opens, the main setup is complete.',
    doneTitle: 'Guide Complete',
    doneBody: 'The comparison view is now ready. You can switch tabs, change phase filters, zoom, and inspect the timeline freely.',
  };
}

function getTutorialSteps() {
  const copy = getTutorialCopy();
  return [
    {
      key: 'intro',
      title: copy.introTitle,
      body: copy.introBody,
      getTarget: () => document.getElementById('step1'),
      waitForAction: false,
    },
    {
      key: 'connect',
      title: copy.connectTitle,
      body: copy.connectBody,
      getTarget: () => el.connectBtn,
      waitForAction: true,
      isComplete: () => Boolean(state.token),
    },
    {
      key: 'reports',
      title: copy.loadReportsTitle,
      body: copy.loadReportsBody,
      getTarget: () => el.loadBtn,
      waitForAction: true,
      isComplete: () => Boolean(state.reportA && state.reportB && !el.step2?.classList.contains('hidden')),
    },
    {
      key: 'players',
      title: copy.loadPlayersTitle,
      body: copy.loadPlayersBody,
      getTarget: () => el.loadPlayersBtn,
      waitForAction: true,
      isComplete: () => Boolean(state.playersA.length && state.playersB.length && !el.step3?.classList.contains('hidden')),
    },
    {
      key: 'compare',
      title: copy.compareTitle,
      body: copy.compareBody,
      getTarget: () => el.compareBtn,
      waitForAction: true,
      isComplete: () => Boolean(!el.step4?.classList.contains('hidden') && state.timelineA.length && state.timelineB.length),
    },
    {
      key: 'done',
      title: copy.doneTitle,
      body: copy.doneBody,
      getTarget: () => el.step4,
      waitForAction: false,
    },
  ];
}

function saveTutorialState() {
  try {
    localStorage.setItem(TUTORIAL_STATE_KEY, JSON.stringify({
      active: state.tutorial.active,
      stepIndex: state.tutorial.stepIndex,
    }));
  } catch {}
}

function restoreTutorialState() {
  try {
    const raw = localStorage.getItem(TUTORIAL_STATE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.active) return;
    state.tutorial.active = true;
    state.tutorial.stepIndex = Number.isFinite(parsed.stepIndex) ? parsed.stepIndex : 0;
  } catch {}
}

function clearTutorialState() {
  try {
    localStorage.removeItem(TUTORIAL_STATE_KEY);
  } catch {}
}

function clearTutorialHighlight() {
  document.querySelectorAll('.tutorial-target').forEach(node => node.classList.remove('tutorial-target'));
  state.tutorial.highlightKey = '';
}

function setTutorialHighlight(target) {
  clearTutorialHighlight();
  if (!target) return;
  target.classList.add('tutorial-target');
  state.tutorial.highlightKey = target.id || target.className || 'tutorial-target';
}

function isTutorialTargetVisible(target) {
  return !!target && !target.classList.contains('hidden') && !!(target.offsetWidth || target.offsetHeight || target.getClientRects().length);
}

function ensureTutorialTargetVisible(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const margin = 48;
  if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
}

function positionTutorialCard(target) {
  if (!state.tutorial.active || !el.tutorialCard) return;
  const fallbackTop = 24;
  const fallbackLeft = Math.max(16, window.innerWidth - 408);
  if (!target || !isTutorialTargetVisible(target)) {
    el.tutorialCard.style.top = `${fallbackTop}px`;
    el.tutorialCard.style.left = `${fallbackLeft}px`;
    return;
  }
  const rect = target.getBoundingClientRect();
  const cardRect = el.tutorialCard.getBoundingClientRect();
  const gap = 18;
  let top = rect.bottom + gap;
  let left = Math.max(16, Math.min(rect.left, window.innerWidth - cardRect.width - 16));
  if (top + cardRect.height > window.innerHeight - 16) {
    top = rect.top - cardRect.height - gap;
  }
  if (top < 16) top = 16;
  if (left < 16) left = 16;
  el.tutorialCard.style.top = `${top}px`;
  el.tutorialCard.style.left = `${left}px`;
}

function getCurrentTutorialStep() {
  const steps = getTutorialSteps();
  const index = Math.max(0, Math.min(state.tutorial.stepIndex, steps.length - 1));
  return { steps, step: steps[index], index };
}

function renderTutorial() {
  if (!el.tutorialOverlay || !el.tutorialCard || !el.tutorialBtn) return;
  const copy = getTutorialCopy();
  el.tutorialBtn.textContent = copy.launch;
  if (!state.tutorial.active) {
    el.tutorialOverlay.classList.add('hidden');
    el.tutorialOverlay.setAttribute('aria-hidden', 'true');
    clearTutorialHighlight();
    return;
  }
  const { steps, step, index } = getCurrentTutorialStep();
  const target = step?.getTarget?.() || document.getElementById('step1');
  const completed = Boolean(step?.isComplete?.());

  el.tutorialOverlay.classList.remove('hidden');
  el.tutorialOverlay.setAttribute('aria-hidden', 'false');
  el.tutorialStepMeta.textContent = copy.step(index + 1, steps.length);
  el.tutorialTitle.textContent = step?.title || copy.introTitle;
  el.tutorialBody.textContent = step?.body || copy.introBody;
  el.tutorialStatus.textContent = step?.waitForAction ? (completed ? copy.ready : copy.waiting) : '';
  el.tutorialStatus.dataset.complete = completed ? 'true' : 'false';
  el.tutorialPrevBtn.textContent = copy.prev;
  el.tutorialNextBtn.textContent = index === steps.length - 1 ? copy.finish : copy.next;
  el.tutorialCloseBtn.setAttribute('aria-label', copy.close);
  el.tutorialPrevBtn.disabled = index === 0;
  el.tutorialNextBtn.disabled = Boolean(step?.waitForAction && !completed);
  ensureTutorialTargetVisible(target);
  setTutorialHighlight(target);
  requestAnimationFrame(() => positionTutorialCard(target));
  saveTutorialState();
}

function syncTutorialProgress() {
  if (!state.tutorial.active) {
    renderTutorial();
    return;
  }
  const steps = getTutorialSteps();
  let index = Math.max(0, Math.min(state.tutorial.stepIndex, steps.length - 1));
  while (index < steps.length - 1) {
    const step = steps[index];
    if (!step.waitForAction || !step.isComplete?.()) break;
    index += 1;
  }
  state.tutorial.stepIndex = index;
  renderTutorial();
}

function startTutorial() {
  state.tutorial.active = true;
  state.tutorial.stepIndex = 0;
  saveTutorialState();
  renderTutorial();
}

function closeTutorial() {
  state.tutorial.active = false;
  state.tutorial.stepIndex = 0;
  clearTutorialHighlight();
  clearTutorialState();
  renderTutorial();
}

function moveTutorial(direction) {
  const { steps, step, index } = getCurrentTutorialStep();
  if (direction > 0 && index === steps.length - 1) {
    closeTutorial();
    return;
  }
  if (direction > 0 && step?.waitForAction && !step.isComplete?.()) return;
  state.tutorial.stepIndex = Math.max(0, Math.min(index + direction, steps.length - 1));
  syncTutorialProgress();
}

bindClick(el.tutorialBtn, 'tutorialBtn', () => {
  logDebug('click: tutorial page');
  clearTutorialState();
  state.tutorial.active = false;
  state.tutorial.stepIndex = 0;
  window.location.href = 'http://xiv-srd.com/tutorial.html';
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

bindClick(el.connectBtn, 'connectBtn', () => {
  logDebug('click: connect');
  if (state.tutorial.active) saveTutorialState();
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
  syncTutorialProgress();
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
    syncTutorialProgress();
  } catch (e) {
    el.msg.textContent = `取得失敗: ${e.message}`;
  } finally {
    el.loadBtn.disabled = false;
    if (state.tutorial.active) renderTutorial();
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
    syncTutorialProgress();
  } catch (e) {
    el.step2Message.textContent = `プレイヤー取得失敗: ${e.message}`;
  } finally {
    if (state.tutorial.active) renderTutorial();
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

  // encounterIDチェック: 異なるボスの比較は警告のみ（ブロックしない）
  if (fightA && fightB && Number(fightA.encounterID) !== Number(fightB.encounterID)) {
    logError('encounterID不一致（警告）', { a: fightA.encounterID, b: fightB.encounterID });
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

    // フェーズ検出（FF Logs公式 phaseTransitions 優先）
    const fightDurationA = ((fightA.endTime || 0) - (fightA.startTime || 0)) / 1000;
    const fightDurationB = ((fightB.endTime || 0) - (fightB.startTime || 0)) / 1000;
    const canShowPhaseSelector =
      Number(fightA.encounterID) === Number(fightB.encounterID) &&
      shouldShowUltimatePhaseSelector(state.reportA, fightA) &&
      shouldShowUltimatePhaseSelector(state.reportB, fightB);
    const officialPhasesA = canShowPhaseSelector ? buildFightPhasesFromFFLogs(state.reportA, fightA) : [];
    const officialPhasesB = canShowPhaseSelector ? buildFightPhasesFromFFLogs(state.reportB, fightB) : [];
    if (officialPhasesA.length) logDebug('FF Logs phases A', officialPhasesA.map(p => `${p.label}: ${p.startT.toFixed(1)}s-${p.endT.toFixed(1)}s`));
    if (officialPhasesB.length) logDebug('FF Logs phases B', officialPhasesB.map(p => `${p.label}: ${p.startT.toFixed(1)}s-${p.endT.toFixed(1)}s`));
    state.phasesA = officialPhasesA.length ? officialPhasesA : (canShowPhaseSelector ? detectPhases(bossA, fightDurationA, fightA.lastPhase) : []);
    state.phasesB = officialPhasesB.length ? officialPhasesB : (canShowPhaseSelector ? detectPhases([], fightDurationB, fightB.lastPhase) : []);
    state.phases = canShowPhaseSelector ? mergePhaseSets(state.phasesA, state.phasesB) : [];
    state.currentPhase = null;
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
    el.step2Message.textContent = t('tlLoaded')(state.timelineA.length, state.timelineB.length);
  } catch (e) {
    state.timelineA = makeSampleTimeline();
    state.timelineB = makeSampleTimeline();
    state.timelineCountA = state.timelineA.length;
    state.timelineCountB = state.timelineB.length;
    state.rollingDpsA = [];
    state.rollingDpsB = [];
    state.phasesA = [];
    state.phasesB = [];
    state.phases = [];
    state.currentPhase = null;
    logError('TL取得失敗 - サンプルデータで表示', {error: e.message});
    el.step2Message.textContent = `TL取得失敗(サンプル表示): ${e.message}`;
  }
  el.step4.classList.remove('hidden');
  state.currentTab = 'all';
  el.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
  renderPhaseButtons();
  el.timelineWrap.classList.remove('hidden');
  try {
    renderTimeline();
  } catch (renderErr) {
    logError('renderTimeline エラー', { error: renderErr.message, stack: renderErr.stack?.split('\n').slice(0, 3).join(' | ') });
    el.timelineWrap.innerHTML = `<p class="message">タイムライン描画エラー: ${renderErr.message}</p>`;
  }
  syncTutorialProgress();
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
  const tutorialCopy = getTutorialCopy();
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
  if (el.debugNormalTitle) el.debugNormalTitle.textContent = s.debugNormalTitle;
  if (el.debugErrorTitle) el.debugErrorTitle.textContent = s.debugErrorTitle;
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
  if (el.tutorialBtn) el.tutorialBtn.textContent = tutorialCopy.launch;
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
  if (state.tutorial.active) renderTutorial();
}
bindClick(el.langToggle, 'langToggle', () => {
  state.lang = state.lang === 'ja' ? 'en' : 'ja';
  applyLang();
  logDebug('lang toggled', { lang: state.lang });
});
try {
  logDebug('script initialized');
  clearTutorialState();
  state.tutorial.active = false;
  state.tutorial.stepIndex = 0;
  applyLang();
  restoreOrAuthorize().then(() => {
  }).catch(e => {
    if (el.msg) el.msg.textContent = `認証初期化失敗: ${e.message}`;
    logError('auth init failed', { message: e.message });
  });
} catch (e) {
  if (el.msg) el.msg.textContent = `初期化失敗: ${e.message}`;
  console.error(e);
}
