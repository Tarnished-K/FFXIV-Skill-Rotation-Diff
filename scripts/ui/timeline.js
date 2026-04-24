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
  return globalThis.AuthUIModule?.requirePremiumFeature
    ? globalThis.AuthUIModule.requirePremiumFeature('synergy-timeline')
    : true;
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
  const stopDrag = (pointerId) => {
    if (!dragState) return;
    if (pointerId !== undefined && dragState.pointerId !== undefined && pointerId !== dragState.pointerId) return;
    wrap.classList.remove('is-dragging');
    wrap.releasePointerCapture?.(dragState.pointerId);
    dragState = null;
  };

  wrap.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    wrap.scrollLeft += delta;
    event.preventDefault?.();
  }, { passive: false });

  wrap.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (typeof event.target?.closest === 'function' && event.target.closest('button, a, input, select, textarea')) return;
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

function renderTimeline() {
  let a = filterTimeline(state.timelineA, state.currentTab);
  let b = filterTimeline(state.timelineB, state.currentTab);
  a = filterTimelineByPhase(a, 'a');
  b = filterTimelineByPhase(b, 'b');
  const phaseA = getCurrentPhaseWindow('a');
  const phaseB = getCurrentPhaseWindow('b');
  const fightEndA = getFightDurationSec(state.fightA);
  const fightEndB = getFightDurationSec(state.fightB);
  const maxT = Math.max(
    1,
    fightEndA,
    fightEndB,
    ...a.map((x) => x.t),
    ...b.map((x) => x.t),
  );
  const pxPerSec = 16 * state.zoom;
  const width = Math.max(1800, maxT * pxPerSec + 220);
  const labelA = state.selectedA?.name || 'A';
  const labelB = state.selectedB?.name || 'B';
  const jobA = state.selectedA?.job || '';
  const jobB = state.selectedB?.job || '';
  const showSynergyLane = Boolean(state.isPremium);

  const filterSynergyRecordsByView = (records, owner) => {
    const phase = getCurrentPhaseWindow(owner);
    return (records || []).filter((record) => {
      if (phase && (record.t < phase.startT || record.t >= phase.endT)) return false;
      if (state.currentTab === 'odd') return Math.floor(record.t / 60) % 2 === 1;
      if (state.currentTab === 'even') return Math.floor(record.t / 60) % 2 === 0 && record.t >= 60;
      return true;
    });
  };

  const getSynergyLaneKey = (record) => String(record.laneKey || record.action || record.actionId || record.label || 'unknown');
  const buildSynergyLaneDefs = (records) => {
    const byKey = new Map();
    for (const record of records || []) {
      const key = getSynergyLaneKey(record);
      if (byKey.has(key)) continue;
      const buff = findBurstBuff(record.actionId, record.action);
      byKey.set(key, {
        key,
        label: record.label || (buff ? (state.lang === 'ja' ? buff.nameJa : buff.nameEn) : record.action),
        color: record.color || buff?.color || '#f2cf7a',
        order: Number.isFinite(record.laneOrder) ? record.laneOrder : 999,
      });
    }
    return [...byKey.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  };
  const synergiesA = showSynergyLane ? filterSynergyRecordsByView(state.partyBuffsA, 'a') : [];
  const synergiesB = showSynergyLane ? filterSynergyRecordsByView(state.partyBuffsB, 'b') : [];
  const synergyLaneDefsA = buildSynergyLaneDefs(synergiesA);
  const synergyLaneDefsB = buildSynergyLaneDefs(synergiesB);
  const synergyRowHeight = 12;
  const synergyBaseOffset = 124;
  const synergyBlockHeightA = showSynergyLane ? Math.max(22, synergyLaneDefsA.length * synergyRowHeight + 14) : 0;
  const synergyBlockHeightB = showSynergyLane ? Math.max(22, synergyLaneDefsB.length * synergyRowHeight + 14) : 0;

  // DPS繧ｰ繝ｩ繝輔・譛臥┌
  const hasDps = state.rollingDpsA.length > 0 || state.rollingDpsB.length > 0;
  const dpsGraphHeight = hasDps ? 80 : 0;
  const dpsGraphTop = hasDps ? 4 : 0;

  // Layout: DPS graph -> ruler -> player A -> divider -> player B
  const rulerTop = dpsGraphTop + dpsGraphHeight;
  const playerAStart = rulerTop + 18;
  const laneTop = {
    a_ogcd: playerAStart + 10,
    a_gcd: playerAStart + 64,
    a_synergy: playerAStart + synergyBaseOffset,
    b_ogcd: 0,
    b_gcd: 0,
    b_synergy: 0,
  };
  const trackATop = playerAStart;
  const trackAHeight = showSynergyLane ? synergyBaseOffset + synergyBlockHeightA + 8 : 110;
  const dividerTop = trackATop + trackAHeight + 16;
  const trackBTop = dividerTop + 30;
  const trackBHeight = showSynergyLane ? synergyBaseOffset + synergyBlockHeightB + 8 : 110;
  laneTop.b_ogcd = trackBTop + 10;
  laneTop.b_gcd = trackBTop + 64;
  laneTop.b_synergy = trackBTop + synergyBaseOffset;
  const totalHeight = trackBTop + trackBHeight + 20;

  const isGcd = r => r.category === 'weaponskill' || r.category === 'spell';

  const buildDpsGraph = () => {
    if (!hasDps) return '';
    let dpsA = state.rollingDpsA;
    let dpsB = state.rollingDpsB;
    if (phaseA) dpsA = dpsA.filter(d => d.t >= phaseA.startT && d.t <= phaseA.endT);
    if (phaseB) dpsB = dpsB.filter(d => d.t >= phaseB.startT && d.t <= phaseB.endT);
    if (state.currentTab === 'odd') {
      dpsA = dpsA.filter(d => Math.floor(d.t / 60) % 2 === 1);
      dpsB = dpsB.filter(d => Math.floor(d.t / 60) % 2 === 1);
    } else if (state.currentTab === 'even') {
      dpsA = dpsA.filter(d => Math.floor(d.t / 60) % 2 === 0 && d.t >= 60);
      dpsB = dpsB.filter(d => Math.floor(d.t / 60) % 2 === 0 && d.t >= 60);
    }
    const maxDps = Math.max(...dpsA.map(p => p.dps), ...dpsB.map(p => p.dps), 1);
    const gH = dpsGraphHeight - 10;
    const toPoints = (pts, color) => {
      if (!pts.length) return '';
      const coords = pts.map(p => {
        const x = 60 + p.t * pxPerSec;
        const y = dpsGraphTop + gH - (p.dps / maxDps) * (gH - 5);
        return `${x},${y}`;
      }).join(' ');
      return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />`;
    };
    // Y霆ｸ繝ｩ繝吶Ν
    const labels = [];
    for (let i = 0; i <= 2; i++) {
      const dps = maxDps * i / 2;
      const y = dpsGraphTop + gH - (dps / maxDps) * (gH - 5);
      const label = dps >= 1000 ? `${(dps / 1000).toFixed(0)}k` : dps.toFixed(0);
      labels.push(`<text x="55" y="${y + 3}" text-anchor="end" fill="#64748b" font-size="9">${label}</text>`);
    }
    return `<svg class="dps-graph-svg" style="position:absolute; left:0; top:0; width:${width}px; height:${dpsGraphTop + dpsGraphHeight}px; pointer-events:none; overflow:visible;">
      <rect x="60" y="${dpsGraphTop}" width="${maxT * pxPerSec}" height="${gH}" fill="#0f172a" rx="4" opacity="0.5" />
      ${labels.join('')}
      <text x="62" y="${dpsGraphTop + 10}" fill="#38bdf8" font-size="9">${labelA}</text>
      <text x="${62 + labelA.length * 7 + 10}" y="${dpsGraphTop + 10}" fill="#f97316" font-size="9">${labelB}</text>
      ${toPoints(dpsA, '#38bdf8')}
      ${toPoints(dpsB, '#f97316')}
    </svg>`;
  };

  const buildRulerAtTop = () => {
    const marks = [];
    for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
      const x = 60 + sec * pxPerSec;
      const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
      const label = sec % 5 === 0 ? `<span>${formatTimelineTime(sec)}</span>` : '';
      marks.push(`<div class="tick ${level}" style="left:${x}px; top:${rulerTop}px">${label}</div>`);
    }
    return marks.join('');
  };

  const buildTimelineGrid = () => {
    const lines = [];
    const height = totalHeight - rulerTop;
    for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
      const x = 60 + sec * pxPerSec;
      const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
      lines.push(`<div class="timeline-grid-line ${level}" style="left:${x}px; top:${rulerTop}px; height:${height}px"></div>`);
    }
    return lines.join('');
  };

  const buildLaneGuides = () => {
    const lines = [
      { key: 'a_ogcd', owner: 'a', type: 'ability' },
      { key: 'a_gcd', owner: 'a', type: 'gcd' },
      { key: 'b_ogcd', owner: 'b', type: 'ability' },
      { key: 'b_gcd', owner: 'b', type: 'gcd' },
    ];
    if (showSynergyLane) {
      synergyLaneDefsA.forEach((_, index) => {
        lines.push({ key: 'a_synergy', owner: 'a', type: 'synergy', top: laneTop.a_synergy + index * synergyRowHeight + 7 });
      });
      synergyLaneDefsB.forEach((_, index) => {
        lines.push({ key: 'b_synergy', owner: 'b', type: 'synergy', top: laneTop.b_synergy + index * synergyRowHeight + 7 });
      });
    }
    return lines.map(({ key, owner, type, top }) => (
      `<div class="lane-guide-line ${owner} ${type}" style="top:${top ?? laneTop[key] + 23}px"></div>`
    )).join('');
  };

  const buildBuffOverlays = (records, owner) => {
    const overlays = [];
    const baseTop = owner === 'a' ? trackATop : trackBTop;
    const h = owner === 'a' ? trackAHeight : trackBHeight;
    for (const r of records) {
      const buff = findBurstBuff(r.actionId, r.action) || findSelfBuff(r.action) || findTinctureBuff(r.action);
      if (!buff) continue;
      const x = 60 + r.t * pxPerSec;
      const w = buff.duration * pxPerSec;
      const label = state.lang === 'ja' ? buff.nameJa : buff.nameEn;
      overlays.push(`<div class="burst-overlay" style="left:${x}px; top:${baseTop}px; width:${w}px; height:${h}px; background:${buff.color}20; border-left:2px solid ${buff.color}60;"><span class="burst-label" style="color:${buff.color}">${label}</span></div>`);
    }
    return overlays.join('');
  };

  const buildSynergyLaneLabels = (defs, owner) => {
    if (!showSynergyLane) return '';
    const baseTop = laneTop[`${owner}_synergy`];
    return defs.map((def, index) => (
      `<div class="synergy-lane-name" style="top:${baseTop + index * synergyRowHeight}px; color:${def.color}" title="${def.label}">${def.label}</div>`
    )).join('');
  };

  const buildSynergyLane = (records, owner, defs) => {
    if (!showSynergyLane) return '';
    const baseTop = laneTop[`${owner}_synergy`];
    const laneIndexByKey = new Map(defs.map((def, index) => [def.key, index]));
    const seen = new Set();
    return (records || []).filter((record) => {
      const key = `${Math.round(record.t * 10)}:${record.actionId || record.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((record) => {
      const buff = findBurstBuff(record.actionId, record.action);
      const duration = record.duration || buff?.duration || 20;
      const x = 60 + record.t * pxPerSec;
      const w = Math.max(24, duration * pxPerSec);
      const label = record.label || (buff ? (state.lang === 'ja' ? buff.nameJa : buff.nameEn) : record.action);
      const color = record.color || buff?.color || '#f2cf7a';
      const laneIndex = laneIndexByKey.get(getSynergyLaneKey(record)) || 0;
      const top = baseTop + laneIndex * synergyRowHeight;
      const source = record.sourceName ? ` / ${record.sourceName}${record.sourceJob ? ` (${record.sourceJob})` : ''}` : '';
      const title = `${formatTimelineTime(record.t)} ${label}${source} (${duration}s)`;
      const candidates = (record.iconCandidates || []).join('|');
      const fallback = (label || record.action || '?').slice(0, 2).toUpperCase();
      const icon = record.icon
        ? `<img class="synergy-start-icon" src="${record.icon}" data-fallbacks="${candidates}" alt="${label}" />`
        : `<span class="synergy-start-icon synergy-start-fallback">${fallback}</span>`;
      return `<div class="synergy-segment ${owner}" style="left:${x}px; top:${top + 2}px; width:${w}px; --synergy-color:${color};" title="${title}"></div>
        <div class="synergy-start ${owner}" style="left:${x - 6}px; top:${top - 2}px; --synergy-color:${color};" title="${title}">${icon}</div>`;
    }).join('');
  };

  const buildPhaseLines = () => {
    if (!state.phases || state.phases.length < 2) return '';
    const parts = [];
    for (const phase of state.phases.slice(1)) {
      if (phase.a) {
        const xA = 60 + phase.a.startT * pxPerSec;
        parts.push(`<div class="phase-divider a" style="left:${xA}px; top:${rulerTop}px; height:${dividerTop - rulerTop}px" title="A ${phase.label}: ${formatTimelineTime(phase.a.startT)}">
          <span class="phase-divider-label">${phase.label}</span>
        </div>`);
      }
      if (phase.b) {
        const xB = 60 + phase.b.startT * pxPerSec;
        parts.push(`<div class="phase-divider b" style="left:${xB}px; top:${dividerTop}px; height:${totalHeight - dividerTop}px" title="B ${phase.label}: ${formatTimelineTime(phase.b.startT)}">
          <span class="phase-divider-label">${phase.label}</span>
        </div>`);
      }
    }
    return parts.join('');
  };

  const buildKillLines = () => {
    const markers = [];
    const rows = [
      { owner: 'a', fightEnd: fightEndA, phase: phaseA, top: rulerTop, height: dividerTop - rulerTop },
      { owner: 'b', fightEnd: fightEndB, phase: phaseB, top: dividerTop, height: totalHeight - dividerTop },
    ];
    for (const row of rows) {
      if (!row.fightEnd) continue;
      let markerT = row.fightEnd;
      if (row.phase) {
        const isInPhase = markerT >= row.phase.startT && markerT <= row.phase.endT + 0.25;
        if (!isInPhase) continue;
        markerT = Math.min(markerT, row.phase.endT);
      }
      const x = 60 + markerT * pxPerSec;
      const label = state.lang === 'ja' ? '討伐' : 'Kill';
      markers.push(`<div class="kill-divider ${row.owner}" style="left:${x}px; top:${row.top}px; height:${row.height}px" title="${label}: ${formatTimelineTime(markerT)}"><span class="kill-divider-label">${label}</span></div>`);
    }
    return markers.join('');
  };

  const buildEvents = (records, owner, partyBuffs) => {
    const lanesLastX = { gcd: -999, ogcd: -999 };
    const minGap = 24;
    return records.map(r => {
      const lane = isGcd(r) ? 'gcd' : 'ogcd';
      const baseX = 60 + r.t * pxPerSec;
      const x = Math.max(baseX, lanesLastX[lane] + minGap);
      lanesLastX[lane] = x;
      const icon = r.icon || '';
      const fallback = (r.label || r.action || '?').slice(0, 2).toUpperCase();
      const top = laneTop[`${owner}_${lane}`];
      const candidates = (r.iconCandidates || []).join('|');
      let tooltip = `${formatTimelineTime(r.t)} ${r.label || r.action}`;
      if (r.damage != null && r.damage > 0) {
        tooltip += `\n${state.lang === 'ja' ? 'ダメージ' : 'Damage'}: ${r.damage.toLocaleString()}`;
        const ht = formatHitType(r.hitType, r.multistrike);
        if (ht) tooltip += ` (${ht})`;
      }
      if (r.healing != null && r.healing > 0) {
        tooltip += `\n${state.lang === 'ja' ? '回復' : 'Healing'}: ${r.healing.toLocaleString()}`;
        if (r.overheal != null && r.overheal > 0) {
          tooltip += ` (${state.lang === 'ja' ? 'オーバーヒール' : 'Overheal'}: ${r.overheal.toLocaleString()})`;
        }
      }
      const synergies = getActiveSynergies(r.t, records, partyBuffs);
      if (synergies.length) {
        tooltip += `\n${state.lang === 'ja' ? 'バフ' : 'Buffs'}: ${synergies.join(', ')}`;
      }
      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${tooltip}">${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${r.label || r.action}" />` : `<span>${fallback}</span>`}</div>`;
    }).join('');
  };

  el.timelineWrap.innerHTML = `
    <div class="timeline" style="width:${width}px; height:${totalHeight}px">
      ${buildDpsGraph()}
      ${buildTimelineGrid()}
      ${buildRulerAtTop()}
      <div class="player-label player-label-a" style="top:${playerAStart - 4}px">${labelA}</div>
      <div class="lane-label" style="top:${laneTop.a_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track a" style="top:${trackATop}px; height:${trackAHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.a_gcd + 12}px">${t('laneGcd')}</div>
      ${showSynergyLane ? `<div class="lane-label" style="top:${laneTop.a_synergy - 14}px">${t('laneSynergy')}</div>` : ''}
      ${buildSynergyLaneLabels(synergyLaneDefsA, 'a')}
      ${buildBuffOverlays(a, 'a')}
      ${buildSynergyLane(synergiesA, 'a', synergyLaneDefsA)}
      <div class="player-divider" style="top:${dividerTop}px"></div>
      <div class="player-label player-label-b" style="top:${dividerTop + 10}px">${labelB}</div>
      <div class="lane-label" style="top:${laneTop.b_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track b" style="top:${trackBTop}px; height:${trackBHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.b_gcd + 12}px">${t('laneGcd')}</div>
      ${showSynergyLane ? `<div class="lane-label" style="top:${laneTop.b_synergy - 14}px">${t('laneSynergy')}</div>` : ''}
      ${buildSynergyLaneLabels(synergyLaneDefsB, 'b')}
      ${buildLaneGuides()}
      ${buildBuffOverlays(b, 'b')}
      ${buildSynergyLane(synergiesB, 'b', synergyLaneDefsB)}
      ${buildEvents(a, 'a', state.partyBuffsA)}
      ${buildEvents(b, 'b', state.partyBuffsB)}
      ${buildPhaseLines()}
      ${buildKillLines()}
    </div>
  `;
  el.timelineWrap.querySelectorAll('img.event-icon, img.synergy-start-icon').forEach(img => {
    const queue = (img.dataset.fallbacks || '').split('|').filter(Boolean);
    const seen = new Set([img.getAttribute('src')]);
    img.addEventListener('error', () => {
      while (queue.length) {
        const next = queue.shift();
        if (!seen.has(next)) {
          seen.add(next);
          img.src = next;
          return;
        }
      }
      const fallback = document.createElement('span');
      fallback.textContent = (img.alt || '?').slice(0, 2).toUpperCase();
      if (img.classList.contains('synergy-start-icon')) {
        fallback.className = 'synergy-start-icon synergy-start-fallback';
      }
      img.replaceWith(fallback);
    });
  });
  bindTimelineInteractions();
}

function renderPhaseButtons() {
  const container = el.phaseContainer;
  if (!container) return;
  container.innerHTML = '';
  if (!state.phases.length) return;
  // 縲悟・繝輔ぉ繝ｼ繧ｺ縲阪・繧ｿ繝ｳ
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
  // 蜷・ヵ繧ｧ繝ｼ繧ｺ繝懊ち繝ｳ
  for (const phase of state.phases) {
    const btn = document.createElement('button');
    const isActive = state.currentPhase && state.currentPhase.id === phase.id;
    btn.className = 'phase-btn' + (isActive ? ' active' : '');
    btn.textContent = String(phase.label || `P${phase.id}`);
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
  formatJobName,
  ensureSynergyTimelineAccess,
  buildFightPhasesFromFFLogs,
  classifyStats,
  computeRollingDps,
  correlateDamage,
  correlateHealing,
  deduplicateTimeline,
  detectPhases,
  fetchPlayerAurasV2,
  mergePhaseSets,
  renderPhaseButtons,
  renderTimeline,
  removeKnownNonDamageFollowupCasts,
  scrollTimelineToPhase,
});


