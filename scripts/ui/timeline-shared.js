(function () {
// Timeline transforms, damage correlation, and rendering
const { computeRollingDps: computeRollingDpsShared } = globalThis.AppSharedUtils;
const {
  buildFightPhasesFromFFLogs: buildFightPhasesFromFFLogsShared,
  detectPhasesFromBossCasts,
  formatPhaseLabel,
  mergePhaseSets: mergePhaseSetsShared,
} = globalThis.PhaseUtils;
const {
  buildRuler: buildRulerShared,
  classifyStats: classifyStatsShared,
  deduplicateTimeline: deduplicateTimelineShared,
  filterTimeline: filterTimelineShared,
  formatHitType: formatHitTypeShared,
  formatTimelineTime: formatTimelineTimeShared,
  isInTimelineFocusWindow,
} = globalThis.TimelineUtils;

function filterTimeline(records, tab) {
  return filterTimelineShared(records, tab);
}
function buildRuler(maxT, pxPerSec) {
  return buildRulerShared(maxT, pxPerSec);
}
function classifyStats(records) {
  return classifyStatsShared(records);
}
function deduplicateTimeline(records) {
  return deduplicateTimelineShared(records);
}
function findSelfBuff(actionName) {
  return globalThis.BuffUtils.findSelfBuff(actionName, SELF_BUFFS);
}
function findTinctureBuff(actionName) {
  const n = String(actionName || '').toLowerCase();
  if (n.includes('tincture') || n.includes('potion') || n.includes('薬')) {
    return { nameEn: 'Tincture', nameJa: '薬', duration: 30, color: '#e879f9' };
  }
  return null;
}
function getActiveSynergies(t, allRecords, partyBuffRecords) {
  return globalThis.BuffUtils.getActiveSynergies(t, allRecords, partyBuffRecords, {
    burstBuffs: BURST_BUFFS,
    selfBuffs: SELF_BUFFS,
    lang: state.lang,
  });
}
async function ensureSynergyTimelineAccess() {
  return true;
}
function buildFightPhasesFromFFLogs(reportJson, fight, lang = 'en') {
  return buildFightPhasesFromFFLogsShared(reportJson, fight, {
    getPhaseLabel(meta, fallbackIndex) {
      return formatPhaseLabel(meta, fallbackIndex, lang);
    },
  });
}

const STATUS_BURST_BUFFS = {
  1000786: 'Battle Litany',
  1001185: 'Brotherhood',
  1001882: 'Divination',
  1001221: 'Chain Stratagem',
  1001239: 'Embolden',
  1002599: 'Arcane Circle',
  1001822: 'Technical Finish', 1002698: 'Technical Finish',
  1002703: 'Searing Light',
  1002722: 'Radiant Finale', 1002964: 'Radiant Finale',
  1003685: 'Starry Muse',
  1004030: 'Dokumori',
  1000141: 'Battle Voice',
};
const STATUS_SELF_BUFFS = {
  1000076: 'Fight or Flight',
  1001177: 'Inner Release', 1001303: 'Inner Release',
  1000742: 'Blood Weapon',
  1001624: 'Delirium', 1003836: 'Delirium',
  1000831: 'No Mercy',
  1001181: 'Riddle of Fire',
  1002720: 'Lance Charge',
  1000125: 'Raging Strikes',
  1000861: 'Wildfire',
  1001825: 'Devilment',
  1000737: 'Ley Lines',
  1001971: 'Manafication',
  1001233: 'Meikyo Shisui',
};
async function fetchPlayerAurasV2(reportCode, fight, targetId) {
  const partyBuffs = [];
  let startTime = null;
  const query = `
    query PlayerAuras($code: String!, $fightID: Int!, $targetID: Int!, $startTime: Float) {
      reportData {
        report(code: $code) {
          events(dataType: Buffs, fightIDs: [$fightID], targetID: $targetID, startTime: $startTime) {
            data
            nextPageTimestamp
          }
        }
      }
    }
  `;
  let rawTotal = 0;
  let pageCount = 0;
  let debugMatchCount = { burst: 0, self: 0 };
  while (true) {
    const vars = { code: reportCode, fightID: Number(fight.id), targetID: Number(targetId), startTime };
    const data = await graphqlRequest(query, vars);
    const block = data?.reportData?.report?.events;
    const rows = block?.data || [];
    rawTotal += rows.length;
    pageCount++;
    if (pageCount === 1) {
      logDebug(`auras raw(target=${targetId}): page1=${rows.length}`, rows.length > 0 ? {
        types: [...new Set(rows.slice(0, 50).map(e => e.type))],
        sample: rows.slice(0, 5).map(e => ({
          type: e.type,
          name: e.ability?.name || state.abilityById.get(Number(e.abilityGameID)) || '(unknown)',
          id: e.abilityGameID,
          dur: e.duration,
          src: e.sourceID,
        }))
      } : 'empty');
    }
    for (const e of rows) {
      const type = String(e?.type || '').toLowerCase();
      const isBuffApply = type === 'applybuff' || type === 'refreshbuff';
      if (!isBuffApply) continue;
      const statusId = Number(e?.abilityGameID || e?.ability?.guid || 0);
      const abilityName = String(e?.ability?.name || state.abilityById.get(statusId) || '');
      const ts = Number(e?.timestamp || 0);
      const tSec = Math.max(0, (ts - Number(fight.startTime || 0)) / 1000);
      const dur = Number(e?.duration || 0) / 1000;

      const burstName = STATUS_BURST_BUFFS[statusId];
      if (burstName) {
        const buff = BURST_BUFFS.find(b => b.nameEn === burstName);
        if (buff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || burstName, duration: buff.duration });
          debugMatchCount.burst++;
          continue;
        }
      }
      const buff = findBurstBuff(statusId, abilityName);
      if (buff) {
        partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || buff.nameEn, duration: buff.duration });
        debugMatchCount.burst++;
        continue;
      }

      const selfName = STATUS_SELF_BUFFS[statusId];
      if (selfName) {
        const selfBuff = SELF_BUFFS.find(b => b.nameEn === selfName);
        if (selfBuff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName || selfName, duration: selfBuff.duration });
          debugMatchCount.self++;
          continue;
        }
      }
      if (abilityName) {
        const selfBuff = findSelfBuff(abilityName);
        if (selfBuff) {
          partyBuffs.push({ t: tSec, actionId: statusId, action: abilityName, duration: selfBuff.duration });
          debugMatchCount.self++;
          continue;
        }
      }
    }
    if (!block?.nextPageTimestamp) break;
    startTime = block.nextPageTimestamp;
  }
  logDebug(`auras(target=${targetId}): raw=${rawTotal} pages=${pageCount} PTbuff=${partyBuffs.length}`, debugMatchCount);
  return partyBuffs;
}
function formatJobName(jobCode) {
  if (state.lang === 'ja') return JOB_NAME_JA[jobCode] || jobCode;
  return jobCode;
}
function findBurstBuff(actionId, actionName) {
  const id = Number(actionId);
  for (const buff of BURST_BUFFS) {
    if (buff.ids.includes(id)) return buff;
  }
  const n = String(actionName || '').toLowerCase();
  for (const buff of BURST_BUFFS) {
    if (n === buff.nameEn.toLowerCase() || n === buff.nameJa) return buff;
  }
  return null;
}
function computeRollingDps(damageEvents, maxT, windowSec = 15) {
  return computeRollingDpsShared(damageEvents, maxT, windowSec);
}

function detectPhases(bossCasts, fightDurationSec, lastPhase) {
  return detectPhasesFromBossCasts(bossCasts, fightDurationSec, lastPhase);
}

function formatHitType(hitType, multistrike) {
  return formatHitTypeShared(hitType, multistrike);
}
function formatTimelineTime(seconds) {
  return formatTimelineTimeShared(seconds);
}
function correlateDamage(timeline, damageEvents) {
  const dmgByAction = new Map();
  for (const d of damageEvents) {
    const key = d.actionId;
    if (!dmgByAction.has(key)) dmgByAction.set(key, []);
    dmgByAction.get(key).push(d);
  }
  for (const ev of timeline) {
    const candidates = dmgByAction.get(ev.actionId) || [];
    let best = null;
    let bestDist = Infinity;
    for (const d of candidates) {
      const dist = Math.abs(d.t - ev.t);
      if (dist < bestDist && dist < 3) {
        bestDist = dist;
        best = d;
      }
    }
    if (best) {
      ev.damage = best.amount;
      ev.hitType = best.hitType;
      ev.multistrike = best.multistrike;
      const idx = candidates.indexOf(best);
      if (idx !== -1) candidates.splice(idx, 1);
    }
  }
}

function correlateHealing(timeline, healingEvents) {
  const healingByAction = new Map();
  for (const event of healingEvents || []) {
    const key = event.actionId;
    if (!healingByAction.has(key)) healingByAction.set(key, []);
    healingByAction.get(key).push(event);
  }
  for (const event of timeline || []) {
    const candidates = healingByAction.get(event.actionId) || [];
    const matches = candidates.filter((healing) => Math.abs(healing.t - event.t) < 3);
    if (!matches.length) continue;
    event.healing = matches.reduce((sum, healing) => sum + Number(healing.amount || 0), 0);
    event.overheal = matches.reduce((sum, healing) => sum + Number(healing.overheal || 0), 0);
    for (const match of matches) {
      const index = candidates.indexOf(match);
      if (index !== -1) candidates.splice(index, 1);
    }
  }
}

function removeKnownNonDamageFollowupCasts(timeline) {
  const followupNames = new Set([
    'starprism',
    'スタープリズム',
    'quadrupletechnicalfinish',
    'quadtechnicalfinish',
    'クワッドテクニカルフィニッシュ',
  ]);
  const normalize = (value) => String(value || '').toLowerCase().replace(/[・･]/g, '').replace(/[^a-z0-9぀-ヿ一-龯]/g, '');
  const hasDamage = (record) => Number(record?.damage || 0) > 0;
  const output = [];
  for (const record of timeline || []) {
    const nameKey = normalize(record.label || record.action);
    const isTarget = followupNames.has(nameKey);
    const previous = output[output.length - 1];
    const previousNameKey = normalize(previous?.label || previous?.action);
    const isNonDamageFollowup =
      isTarget
      && !hasDamage(record)
      && previous
      && previousNameKey === nameKey
      && hasDamage(previous)
      && Math.abs(Number(record.t || 0) - Number(previous.t || 0)) <= 1.5;
    if (isNonDamageFollowup) continue;
    output.push(record);
  }
  return output;
}
function mergePhaseSets(phasesA, phasesB) {
  return mergePhaseSetsShared(phasesA, phasesB);
}
function scrollTimelineToPhase(phase) {
  if (!el.timelineWrap || !phase) return;
  const startTimes = [phase.a?.startT, phase.b?.startT].filter(t => Number.isFinite(t));
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
function getCurrentPhaseWindow(owner) {
  if (!state.currentPhase) return null;
  return owner === 'b' ? (state.currentPhase.b || state.currentPhase.a || null) : (state.currentPhase.a || state.currentPhase.b || null);
}
function filterTimelineByPhase(records, owner) {
  const p = getCurrentPhaseWindow(owner);
  if (!p) return records;
  return records.filter(r => r.t >= p.startT && r.t < p.endT);
}

function getFightDurationSec(fight) {
  const start = Number(fight?.startTime || 0);
  const end = Number(fight?.endTime || 0);
  return Math.max(0, (end - start) / 1000);
}

function bindTimelineInteractions() {
  const wrap = el.timelineWrap;
  if (!wrap || wrap.dataset.timelineInteractionsBound === 'true') return;

  let dragState = null;
  const getTimelineModalTarget = (event) => {
    if (typeof event.target?.closest !== 'function') return null;
    return event.target.closest('.pt-custom-modal, .pt-custom-backdrop');
  };
  const stopDrag = (pointerId) => {
    if (!dragState) return;
    if (pointerId !== undefined && dragState.pointerId !== undefined && pointerId !== dragState.pointerId) return;
    wrap.classList.remove('is-dragging');
    wrap.releasePointerCapture?.(dragState.pointerId);
    dragState = null;
  };

  wrap.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;
    const modalTarget = getTimelineModalTarget(event);
    if (modalTarget) {
      if (modalTarget.classList?.contains('pt-custom-backdrop')) event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    wrap.scrollLeft += delta;
    event.preventDefault?.();
  }, { passive: false });

  wrap.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const modalTarget = getTimelineModalTarget(event);
    if (modalTarget) {
      if (!event.target?.closest?.('button, input, label')) event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    if (typeof event.target?.closest === 'function' && event.target.closest('button, a, input, select, textarea, .pt-custom-modal, .pt-custom-backdrop, .pt-filter-controls')) return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: wrap.scrollLeft,
    };
    wrap.classList.add('is-dragging');
    wrap.setPointerCapture?.(event.pointerId);
    event.preventDefault?.();
  });

  wrap.addEventListener('pointermove', (event) => {
    if (!dragState) return;
    wrap.scrollLeft = dragState.startScrollLeft - (event.clientX - dragState.startX);
    event.preventDefault?.();
  });

  wrap.addEventListener('pointerup', (event) => stopDrag(event.pointerId));
  wrap.addEventListener('pointercancel', (event) => stopDrag(event.pointerId));
  wrap.dataset.timelineInteractionsBound = 'true';
}

Object.assign(globalThis, {
  TimelineRenderShared: {
    filterTimeline,
    buildRuler,
    classifyStats,
    deduplicateTimeline,
    findSelfBuff,
    findTinctureBuff,
    getActiveSynergies,
    ensureSynergyTimelineAccess,
    buildFightPhasesFromFFLogs,
    fetchPlayerAurasV2,
    formatJobName,
    findBurstBuff,
    computeRollingDps,
    detectPhases,
    formatHitType,
    formatTimelineTime,
    formatTimelineTimeShared,
    isInTimelineFocusWindow,
    correlateDamage,
    correlateHealing,
    removeKnownNonDamageFollowupCasts,
    mergePhaseSets,
    scrollTimelineToPhase,
    getCurrentPhaseWindow,
    filterTimelineByPhase,
    getFightDurationSec,
    bindTimelineInteractions,
  },
});
}());
