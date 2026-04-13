// UI event wiring, language application, and bootstrap

bindClick(el.connectBtn, 'connectBtn', () => {
  logDebug('click: connect');
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
  } catch (e) {
    el.msg.textContent = `取得失敗: ${e.message}`;
  } finally {
    el.loadBtn.disabled = false;
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
  } catch (e) {
    el.step2Message.textContent = `プレイヤー取得失敗: ${e.message}`;
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

    // フェーズ検出（ボス詠唱ギャップから）
    const fightDuration = ((fightA.endTime || 0) - (fightA.startTime || 0)) / 1000;
    state.phases = detectPhases(bossA, fightDuration, fightA.lastPhase);
    state.currentPhase = null;
    if (state.phases.length) {
      logDebug(`フェーズ検出: ${state.phases.length}フェーズ`, state.phases.map(p => `${p.label}: ${p.startT.toFixed(0)}s-${p.endT.toFixed(0)}s`));
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
}
bindClick(el.langToggle, 'langToggle', () => {
  state.lang = state.lang === 'ja' ? 'en' : 'ja';
  applyLang();
  logDebug('lang toggled', { lang: state.lang });
});
try {
  logDebug('script initialized');
  applyLang();
  restoreOrAuthorize().catch(e => {
    if (el.msg) el.msg.textContent = `認証初期化失敗: ${e.message}`;
    logError('auth init failed', { message: e.message });
  });
} catch (e) {
  if (el.msg) el.msg.textContent = `初期化失敗: ${e.message}`;
  console.error(e);
}
