(function attachTutorialModule(root, factory) {
  const exports = factory(root);
  root.TutorialModule = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTutorialModule(root) {
  function getRuntime() {
    return {
      state: root.state,
      el: root.el,
      I18N: root.I18N || {},
      TUTORIAL_STATE_KEY: root.TUTORIAL_STATE_KEY,
      localStorage: root.localStorage,
      document: root.document,
      window: root.window,
      requestAnimationFrame: root.requestAnimationFrame || ((callback) => callback()),
    };
  }

  function getTutorialCopy() {
    const { state, I18N } = getRuntime();
    const english = I18N.en || {};
    const localized = I18N[state?.lang] || english;

    return {
      launch: localized.tutorialBtn || english.tutorialBtn || 'First time here?',
      prev: localized.tutorialPrev || english.tutorialPrev || 'Back',
      next: localized.tutorialNext || english.tutorialNext || 'Next',
      finish: localized.tutorialFinish || english.tutorialFinish || 'Done',
      close: localized.tutorialClose || english.tutorialClose || 'Close',
      waiting: localized.tutorialWaiting || english.tutorialWaiting || 'Waiting for this step to be completed.',
      ready: localized.tutorialReady || english.tutorialReady || 'Completed. Move to the next step.',
      step: localized.tutorialStep || english.tutorialStep || ((current, total) => `Step ${current} / ${total}`),
      introTitle: localized.tutorialIntroTitle || english.tutorialIntroTitle || 'Quick Start Guide',
      introBody: localized.tutorialIntroBody || english.tutorialIntroBody || 'This guide walks you through the minimum steps needed to load two public logs and reach the comparison timeline.',
      loadReportsTitle: localized.tutorialLoadReportsTitle || english.tutorialLoadReportsTitle || '1. Enter two public log URLs',
      loadReportsBody: localized.tutorialLoadReportsBody || english.tutorialLoadReportsBody || 'Paste one FF Logs report URL into A and one into B, then load the reports. When the fight selectors appear, this step is complete.',
      loadPlayersTitle: localized.tutorialLoadPlayersTitle || english.tutorialLoadPlayersTitle || '2. Choose fights and load players',
      loadPlayersBody: localized.tutorialLoadPlayersBody || english.tutorialLoadPlayersBody || 'Pick the fight you want to compare from each log, then load the player list for both sides.',
      compareTitle: localized.tutorialCompareTitle || english.tutorialCompareTitle || '3. Choose players and start comparison',
      compareBody: localized.tutorialCompareBody || english.tutorialCompareBody || 'Select one player from each log and run the comparison. When the timeline panel opens, the main setup is complete.',
      doneTitle: localized.tutorialDoneTitle || english.tutorialDoneTitle || 'Guide Complete',
      doneBody: localized.tutorialDoneBody || english.tutorialDoneBody || 'The comparison view is now ready. You can switch tabs, change phase filters, zoom, and inspect the timeline freely.',
    };
  }

  function getTutorialSteps() {
    const { state, el, document } = getRuntime();
    const copy = getTutorialCopy();
    return [
      {
        key: 'intro',
        title: copy.introTitle,
        body: copy.introBody,
        getTarget: () => document?.getElementById?.('step1') || null,
        waitForAction: false,
      },
      {
        key: 'reports',
        title: copy.loadReportsTitle,
        body: copy.loadReportsBody,
        getTarget: () => el?.loadBtn || null,
        waitForAction: true,
        isComplete: () => Boolean(state?.reportA && state?.reportB && !el?.step2?.classList?.contains?.('hidden')),
      },
      {
        key: 'players',
        title: copy.loadPlayersTitle,
        body: copy.loadPlayersBody,
        getTarget: () => el?.loadPlayersBtn || null,
        waitForAction: true,
        isComplete: () => Boolean(state?.playersA?.length && state?.playersB?.length && !el?.step3?.classList?.contains?.('hidden')),
      },
      {
        key: 'compare',
        title: copy.compareTitle,
        body: copy.compareBody,
        getTarget: () => el?.compareBtn || null,
        waitForAction: true,
        isComplete: () => Boolean(!el?.step4?.classList?.contains?.('hidden') && state?.timelineA?.length && state?.timelineB?.length),
      },
      {
        key: 'done',
        title: copy.doneTitle,
        body: copy.doneBody,
        getTarget: () => el?.step4 || null,
        waitForAction: false,
      },
    ];
  }

  function saveTutorialState() {
    const { state, localStorage, TUTORIAL_STATE_KEY } = getRuntime();
    try {
      localStorage?.setItem?.(TUTORIAL_STATE_KEY, JSON.stringify({
        active: state?.tutorial?.active,
        stepIndex: state?.tutorial?.stepIndex,
      }));
    } catch {}
  }

  function restoreTutorialState() {
    const { state, localStorage, TUTORIAL_STATE_KEY } = getRuntime();
    try {
      const raw = localStorage?.getItem?.(TUTORIAL_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.active || !state?.tutorial) return;
      state.tutorial.active = true;
      state.tutorial.stepIndex = Number.isFinite(parsed.stepIndex) ? parsed.stepIndex : 0;
    } catch {}
  }

  function clearTutorialState() {
    const { localStorage, TUTORIAL_STATE_KEY } = getRuntime();
    try {
      localStorage?.removeItem?.(TUTORIAL_STATE_KEY);
    } catch {}
  }

  function clearTutorialHighlight() {
    const { state, document } = getRuntime();
    document?.querySelectorAll?.('.tutorial-target')?.forEach?.((node) => node.classList.remove('tutorial-target'));
    if (state?.tutorial) state.tutorial.highlightKey = '';
  }

  function setTutorialHighlight(target) {
    const { state } = getRuntime();
    clearTutorialHighlight();
    if (!target) return;
    target.classList?.add?.('tutorial-target');
    if (state?.tutorial) state.tutorial.highlightKey = target.id || target.className || 'tutorial-target';
  }

  function isTutorialTargetVisible(target) {
    return !!target
      && !target.classList?.contains?.('hidden')
      && !!(target.offsetWidth || target.offsetHeight || target.getClientRects?.().length);
  }

  function ensureTutorialTargetVisible(target) {
    const { window } = getRuntime();
    if (!target) return;
    const rect = target.getBoundingClientRect?.();
    const margin = 48;
    if (rect && (rect.top < margin || rect.bottom > window.innerHeight - margin)) {
      target.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  function positionTutorialCard(target) {
    const { state, el, window } = getRuntime();
    if (!state?.tutorial?.active || !el?.tutorialCard) return;
    const fallbackTop = 24;
    const fallbackLeft = Math.max(16, window.innerWidth - 408);
    if (!target || !isTutorialTargetVisible(target)) {
      el.tutorialCard.style.top = `${fallbackTop}px`;
      el.tutorialCard.style.left = `${fallbackLeft}px`;
      return;
    }
    const rect = target.getBoundingClientRect?.();
    const cardRect = el.tutorialCard.getBoundingClientRect?.();
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
    const { state } = getRuntime();
    const steps = getTutorialSteps();
    const index = Math.max(0, Math.min(state?.tutorial?.stepIndex || 0, steps.length - 1));
    return { steps, step: steps[index], index };
  }

  function renderTutorial() {
    const { state, el, document, requestAnimationFrame } = getRuntime();
    if (!el?.tutorialOverlay || !el?.tutorialCard || !el?.tutorialBtn) return;
    const copy = getTutorialCopy();
    el.tutorialBtn.textContent = copy.launch;
    if (!state?.tutorial?.active) {
      el.tutorialOverlay.classList.add('hidden');
      el.tutorialOverlay.setAttribute?.('aria-hidden', 'true');
      clearTutorialHighlight();
      return;
    }
    const { steps, step, index } = getCurrentTutorialStep();
    const target = step?.getTarget?.() || document?.getElementById?.('step1') || null;
    const completed = Boolean(step?.isComplete?.());

    el.tutorialOverlay.classList.remove('hidden');
    el.tutorialOverlay.setAttribute?.('aria-hidden', 'false');
    el.tutorialStepMeta.textContent = copy.step(index + 1, steps.length);
    el.tutorialTitle.textContent = step?.title || copy.introTitle;
    el.tutorialBody.textContent = step?.body || copy.introBody;
    el.tutorialStatus.textContent = step?.waitForAction ? (completed ? copy.ready : copy.waiting) : '';
    el.tutorialStatus.dataset.complete = completed ? 'true' : 'false';
    el.tutorialPrevBtn.textContent = copy.prev;
    el.tutorialNextBtn.textContent = index === steps.length - 1 ? copy.finish : copy.next;
    el.tutorialCloseBtn.setAttribute?.('aria-label', copy.close);
    el.tutorialPrevBtn.disabled = index === 0;
    el.tutorialNextBtn.disabled = Boolean(step?.waitForAction && !completed);
    ensureTutorialTargetVisible(target);
    setTutorialHighlight(target);
    requestAnimationFrame(() => positionTutorialCard(target));
    saveTutorialState();
  }

  function syncTutorialProgress() {
    const { state } = getRuntime();
    if (!state?.tutorial?.active) {
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
    const { state } = getRuntime();
    if (!state?.tutorial) return;
    state.tutorial.active = true;
    state.tutorial.stepIndex = 0;
    saveTutorialState();
    renderTutorial();
  }

  function closeTutorial() {
    const { state } = getRuntime();
    if (!state?.tutorial) return;
    state.tutorial.active = false;
    state.tutorial.stepIndex = 0;
    clearTutorialHighlight();
    clearTutorialState();
    renderTutorial();
  }

  function moveTutorial(direction) {
    const { state } = getRuntime();
    const { steps, step, index } = getCurrentTutorialStep();
    if (direction > 0 && index === steps.length - 1) {
      closeTutorial();
      return;
    }
    if (direction > 0 && step?.waitForAction && !step.isComplete?.()) return;
    state.tutorial.stepIndex = Math.max(0, Math.min(index + direction, steps.length - 1));
    syncTutorialProgress();
  }

  return {
    clearTutorialState,
    closeTutorial,
    getCurrentTutorialStep,
    getTutorialCopy,
    getTutorialSteps,
    moveTutorial,
    positionTutorialCard,
    renderTutorial,
    restoreTutorialState,
    startTutorial,
    syncTutorialProgress,
  };
}));
