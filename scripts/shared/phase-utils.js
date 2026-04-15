(function attachPhaseUtils(root, factory) {
  const exports = factory();
  root.PhaseUtils = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPhaseUtils() {
  function buildPhaseStarts(boundaryTimes, fightDurationSec, desiredPhaseCount = 0) {
    const starts = [0];
    for (const time of [...boundaryTimes].sort((a, b) => a - b)) {
      if (time <= 0 || time >= fightDurationSec) continue;
      if (time - starts[starts.length - 1] < 3) continue;
      starts.push(time);
    }

    while (desiredPhaseCount > 0 && starts.length < desiredPhaseCount) {
      let widestIndex = -1;
      let widestSpan = 0;
      for (let i = 0; i < starts.length; i += 1) {
        const segStart = starts[i];
        const segEnd = i < starts.length - 1 ? starts[i + 1] : fightDurationSec;
        const span = segEnd - segStart;
        if (span > widestSpan) {
          widestSpan = span;
          widestIndex = i;
        }
      }

      if (widestIndex === -1 || widestSpan < 6) break;
      const segStart = starts[widestIndex];
      const midpoint = segStart + widestSpan / 2;
      starts.splice(widestIndex + 1, 0, midpoint);
    }

    return starts.map((startT, index) => ({
      id: index + 1,
      startT,
      endT: index < starts.length - 1 ? starts[index + 1] : fightDurationSec,
      label: `P${index + 1}`,
    }));
  }

  function detectPhasesFromBossCasts(bossCasts, fightDurationSec, lastPhase) {
    const hasMultiPhase = Boolean(lastPhase && lastPhase > 1);
    const desiredPhaseCount = hasMultiPhase ? Number(lastPhase) : 0;

    if (!bossCasts || bossCasts.length < 2) {
      return {
        phases: hasMultiPhase ? buildPhaseStarts([], fightDurationSec, desiredPhaseCount) : [],
        boundaryTimes: [],
        usedFallbackSplit: hasMultiPhase,
        incompleteLastPhase: false,
      };
    }

    const sortedCasts = [...bossCasts].sort((a, b) => a.t - b.t);
    const boundaryTimes = [];
    const seenBosses = new Set();

    for (const cast of sortedCasts) {
      const bossKey = String(cast.sourceName || '').trim().toLowerCase();
      if (!bossKey) continue;
      if (seenBosses.has(bossKey)) continue;
      seenBosses.add(bossKey);
      if (seenBosses.size > 1 && cast.t > 3) boundaryTimes.push(cast.t);
    }

    const minGap = 3;
    let lastEndT = 0;
    for (const cast of sortedCasts) {
      if (cast.t - lastEndT > minGap && lastEndT > 3) {
        boundaryTimes.push(cast.t);
      }
      lastEndT = Math.max(lastEndT, cast.endT || cast.t);
    }

    const phases = buildPhaseStarts(boundaryTimes, fightDurationSec, desiredPhaseCount);
    return {
      phases: phases.length > 1 ? phases : [],
      boundaryTimes,
      usedFallbackSplit: false,
      incompleteLastPhase: Boolean(hasMultiPhase && phases.length < lastPhase),
    };
  }

  function normalizePhaseTransitionStartTime(rawStartTime, fight) {
    const raw = Number(rawStartTime || 0);
    if (!raw) return 0;

    const fightStart = Number(fight?.startTime || 0);
    const fightEnd = Number(fight?.endTime || 0);
    const fightDurationSec = Math.max(1, (fightEnd - fightStart) / 1000);
    if (raw >= fightStart && raw <= fightEnd + 1000) {
      return Math.max(0, (raw - fightStart) / 1000);
    }
    if (raw > fightDurationSec + 10) {
      return Math.max(0, raw / 1000);
    }
    return Math.max(0, raw);
  }

  function getEncounterPhaseMetadata(reportJson, fight) {
    const encounterId = Number(fight?.encounterID || 0);
    const phaseSet = (reportJson?.phases || [])
      .find((entry) => Number(entry?.encounterID || 0) === encounterId);
    return phaseSet?.phases || [];
  }

  function defaultPhaseLabel(meta, fallbackIndex) {
    const name = String(meta?.name || '').trim();
    if (name) return name;
    if (meta?.isIntermission) return `Intermission ${fallbackIndex}`;
    return `P${fallbackIndex}`;
  }

  function buildFightPhasesFromFFLogs(reportJson, fight, options = {}) {
    const metadata = getEncounterPhaseMetadata(reportJson, fight);
    const fightDurationSec = Math.max(1, ((fight?.endTime || 0) - (fight?.startTime || 0)) / 1000);
    const maxAbsoluteIndex = Number(fight?.lastPhaseAsAbsoluteIndex || 0);
    const relevantMetadata = maxAbsoluteIndex > 0 ? metadata.slice(0, maxAbsoluteIndex) : metadata;
    const getPhaseLabel = typeof options.getPhaseLabel === 'function'
      ? options.getPhaseLabel
      : defaultPhaseLabel;

    const transitions = (fight?.phaseTransitions || [])
      .map((transition) => ({
        id: Number(transition?.id || 0),
        startT: normalizePhaseTransitionStartTime(transition?.startTime, fight),
      }))
      .filter((transition) => transition.id > 0 && transition.startT > 0 && transition.startT < fightDurationSec)
      .sort((a, b) => a.startT - b.startT);

    if (!relevantMetadata.length && !transitions.length) return [];

    const metadataById = new Map(relevantMetadata.map((meta) => [Number(meta.id || 0), meta]));
    const phaseStarts = [];
    if (relevantMetadata.length) {
      const firstMeta = relevantMetadata[0];
      phaseStarts.push({
        id: Number(firstMeta.id || 1),
        startT: 0,
        label: getPhaseLabel(firstMeta, 1),
        isIntermission: !!firstMeta.isIntermission,
      });
    } else {
      phaseStarts.push({ id: 1, startT: 0, label: 'P1', isIntermission: false });
    }

    for (const transition of transitions) {
      const meta = metadataById.get(transition.id) || null;
      const fallbackIndex = phaseStarts.length + 1;
      const prev = phaseStarts[phaseStarts.length - 1];
      if (prev && Math.abs(prev.startT - transition.startT) < 0.2) continue;
      phaseStarts.push({
        id: transition.id || fallbackIndex,
        startT: transition.startT,
        label: getPhaseLabel(meta, fallbackIndex),
        isIntermission: !!meta?.isIntermission,
      });
    }

    const phases = phaseStarts.map((phase, index) => ({
      id: index + 1,
      phaseId: phase.id,
      startT: phase.startT,
      endT: index < phaseStarts.length - 1 ? phaseStarts[index + 1].startT : fightDurationSec,
      label: phase.label,
      isIntermission: phase.isIntermission,
    }));
    return phases.filter((phase, index) => phase.endT > phase.startT || index === phases.length - 1);
  }

  function mergePhaseSets(phasesA, phasesB) {
    const count = Math.max(phasesA?.length || 0, phasesB?.length || 0);
    const merged = [];
    for (let i = 0; i < count; i += 1) {
      const a = phasesA?.[i] || null;
      const b = phasesB?.[i] || null;
      if (!a && !b) continue;
      merged.push({
        id: i + 1,
        label: a?.label || b?.label || `P${i + 1}`,
        startT: a?.startT ?? b?.startT ?? 0,
        endT: a?.endT ?? b?.endT ?? 0,
        a,
        b,
      });
    }
    return merged;
  }

  return {
    buildFightPhasesFromFFLogs,
    buildPhaseStarts,
    detectPhasesFromBossCasts,
    getEncounterPhaseMetadata,
    mergePhaseSets,
    normalizePhaseTransitionStartTime,
  };
}));
