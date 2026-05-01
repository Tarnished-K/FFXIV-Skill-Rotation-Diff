const {
  filterTimeline,
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
} = globalThis.TimelineRenderShared;
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
  const showSynergyLane = state.showSynergyTimeline !== false;
  const showDebuffLane = state.showDebuffTimeline !== false;
  const showCastLane = Boolean(state.isPremium && state.showCastTimeline !== false);

  const filterSynergyRecordsByView = (records, owner) => {
    const phase = getCurrentPhaseWindow(owner);
    return (records || []).filter((record) => {
      if (phase && (record.t < phase.startT || record.t >= phase.endT)) return false;
      if (state.currentTab === 'odd' || state.currentTab === 'even') return isInTimelineFocusWindow(record.t, state.currentTab);
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
  const bossCastsA = showCastLane ? filterSynergyRecordsByView(state.bossCastsA, 'a') : [];
  const bossCastsB = showCastLane ? filterSynergyRecordsByView(state.bossCastsB, 'b') : [];
  const playerDebuffsA = showDebuffLane ? filterSynergyRecordsByView(state.playerDebuffsA, 'a') : [];
  const playerDebuffsB = showDebuffLane ? filterSynergyRecordsByView(state.playerDebuffsB, 'b') : [];
  const hasDebuffLaneA = playerDebuffsA.length > 0;
  const hasDebuffLaneB = playerDebuffsB.length > 0;
  const synergyLaneDefsA = buildSynergyLaneDefs(synergiesA);
  const synergyLaneDefsB = buildSynergyLaneDefs(synergiesB);
  const synergyRowHeight = 12;
  const synergyBaseOffset = 124;
  const synergyBlockHeightA = showSynergyLane ? Math.max(22, synergyLaneDefsA.length * synergyRowHeight + 14) : 0;
  const synergyBlockHeightB = showSynergyLane ? Math.max(22, synergyLaneDefsB.length * synergyRowHeight + 14) : 0;
  const debuffLaneHeightA = hasDebuffLaneA ? 24 : 0;
  const debuffLaneHeightB = hasDebuffLaneB ? 24 : 0;

  const BOSS_LANE_H = 32;
  const ADD_LANE_H = 30;
  const LANE_GAP = 6;
  const buildCastLaneGroup = (records, owner) => {
    const casts = records.map((r) => ({ ...r, owner }));
    const bossCasts = casts.filter((r) => r.isBoss !== false);
    const addCasts = casts.filter((r) => r.isBoss === false);
    const hasBossLane = bossCasts.length > 0;
    const hasAddLane = addCasts.length > 0;
    const hasAnyLane = hasBossLane || hasAddLane;
    const totalHeight =
      (hasAddLane ? ADD_LANE_H + LANE_GAP : 0) +
      (hasBossLane ? BOSS_LANE_H + LANE_GAP : 0);
    return { bossCasts, addCasts, hasBossLane, hasAddLane, hasAnyLane, totalHeight };
  };
  const castLanesA = buildCastLaneGroup(bossCastsA, 'a');
  const castLanesB = buildCastLaneGroup(bossCastsB, 'b');

  // DPS グラフ
  const hasDps = state.rollingDpsA.length > 0 || state.rollingDpsB.length > 0;
  const canShowDpsGraph = Boolean(state.isPremium);
  const freeDpsPreviewSec = 30;
  const dpsGraphHeight = hasDps ? 80 : 0;
  const dpsGraphTop = hasDps ? 4 : 0;

  const assignCastLaneTops = (laneGroup, areaTop) => {
    let offset = areaTop;
    const addTop = laneGroup.hasAddLane ? offset : 0;
    if (laneGroup.hasAddLane) offset += ADD_LANE_H + LANE_GAP;
    const bossTop = laneGroup.hasBossLane ? offset : 0;
    return { addTop, bossTop };
  };
  const laneAreaTopA = dpsGraphTop + dpsGraphHeight + (castLanesA.hasAnyLane ? 8 : 0);
  const castLaneTopsA = assignCastLaneTops(castLanesA, laneAreaTopA);

  // Layout: DPS graph -> boss lanes -> ruler -> player A -> divider -> player B
  const rulerTop = laneAreaTopA + castLanesA.totalHeight + (castLanesA.hasAnyLane ? 4 : 0);
  const playerAStart = rulerTop + 18;
  const laneTop = {
    a_ogcd: playerAStart + 10,
    a_gcd: playerAStart + 64,
    a_synergy: playerAStart + synergyBaseOffset,
    b_ogcd: 0,
    b_gcd: 0,
    b_synergy: 0,
    a_debuff: 0,
    b_debuff: 0,
  };
  const trackATop = playerAStart;
  laneTop.a_debuff = laneTop.a_synergy + synergyBlockHeightA + 8;
  const trackAHeight = Math.max(110, synergyBaseOffset + synergyBlockHeightA + debuffLaneHeightA + 14);
  const dividerTop = trackATop + trackAHeight + 10;
  const laneAreaTopB = dividerTop + 22;
  const castLaneTopsB = assignCastLaneTops(castLanesB, laneAreaTopB);
  const trackBTop = laneAreaTopB + castLanesB.totalHeight + (castLanesB.hasAnyLane ? 12 : 0);
  const trackBHeight = Math.max(110, synergyBaseOffset + synergyBlockHeightB + debuffLaneHeightB + 14);
  laneTop.b_ogcd = trackBTop + 10;
  laneTop.b_gcd = trackBTop + 64;
  laneTop.b_synergy = trackBTop + synergyBaseOffset;
  laneTop.b_debuff = laneTop.b_synergy + synergyBlockHeightB + 8;
  const totalHeight = trackBTop + trackBHeight + 20;

  const isGcd = r => r.category === 'weaponskill' || r.category === 'spell';

  const buildDpsGraph = () => {
    if (!hasDps) return '';
    const buildFreeDpsMask = () => {
      if (canShowDpsGraph || maxT <= freeDpsPreviewSec) return '';
      const maskLeft = 60 + freeDpsPreviewSec * pxPerSec;
      const maskWidth = Math.max(0, (maxT - freeDpsPreviewSec) * pxPerSec);
      const title = state.lang === 'ja' ? '30秒以降のDPS推移はサポーター向けです' : 'DPS after 30s is a Supporter feature';
      const body = state.lang === 'ja'
        ? '最初の30秒は無料で確認できます。以降の推移を確認するにはサポーター登録をご利用ください。'
        : 'The first 30 seconds are visible for free. Register as a Supporter to inspect the rest of the graph.';
      const href = state.lang === 'en' ? '/premium.html?feature=dps-graph&lang=en' : '/premium.html?feature=dps-graph';
      const cta = state.lang === 'ja' ? 'サポーター特典を見る' : 'View benefits';
      return `<div class="dps-supporter-mask" style="left:${maskLeft}px; top:${dpsGraphTop}px; width:${maskWidth}px; height:${dpsGraphHeight - 10}px">
        <div><strong>${title}</strong><span>${body}</span></div>
        <a href="${href}">${cta}</a>
      </div>`;
    };
    let dpsA = state.rollingDpsA;
    let dpsB = state.rollingDpsB;
    if (phaseA) dpsA = dpsA.filter(d => d.t >= phaseA.startT && d.t <= phaseA.endT);
    if (phaseB) dpsB = dpsB.filter(d => d.t >= phaseB.startT && d.t <= phaseB.endT);
    if (state.currentTab === 'odd' || state.currentTab === 'even') {
      dpsA = dpsA.filter(d => isInTimelineFocusWindow(d.t, state.currentTab));
      dpsB = dpsB.filter(d => isInTimelineFocusWindow(d.t, state.currentTab));
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
    const hitPoints = (pts, color, label) => pts.map((point) => {
      const x = 60 + point.t * pxPerSec;
      const y = dpsGraphTop + gH - (point.dps / maxDps) * (gH - 5);
      const tooltip = `${label} ${formatTimelineTime(point.t)} DPS: ${Math.round(point.dps).toLocaleString()}`;
      return `<circle class="dps-graph-hit" cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0.01"><title>${escapeHtml(tooltip)}</title></circle>`;
    }).join('');
    const hoverLines = (pts, color, label) => {
      if (pts.length < 2) return '';
      const parts = [];
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const point = pts[i];
        const x1 = 60 + prev.t * pxPerSec;
        const y1 = dpsGraphTop + gH - (prev.dps / maxDps) * (gH - 5);
        const x2 = 60 + point.t * pxPerSec;
        const y2 = dpsGraphTop + gH - (point.dps / maxDps) * (gH - 5);
        const tooltip = `${label} ${formatTimelineTime(point.t)} DPS: ${Math.round(point.dps).toLocaleString()}`;
        parts.push(`<line class="dps-graph-hover-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="18" opacity="0"><title>${escapeHtml(tooltip)}</title></line>`);
      }
      return parts.join('');
    };
    // Y霆ｸ繝ｩ繝吶Ν
    const labels = [];
    for (let i = 0; i <= 2; i++) {
      const dps = maxDps * i / 2;
      const y = dpsGraphTop + gH - (dps / maxDps) * (gH - 5);
      const label = dps >= 1000 ? `${(dps / 1000).toFixed(0)}k` : dps.toFixed(0);
      labels.push(`<text x="55" y="${y + 3}" text-anchor="end" fill="#64748b" font-size="9">${label}</text>`);
    }
    return `<svg class="dps-graph-svg" style="position:absolute; left:0; top:0; width:${width}px; height:${dpsGraphTop + dpsGraphHeight}px; pointer-events:auto; overflow:visible;">
      <rect x="60" y="${dpsGraphTop}" width="${maxT * pxPerSec}" height="${gH}" fill="#0f172a" rx="4" opacity="0.5" />
      ${labels.join('')}
      <text x="62" y="${dpsGraphTop + 10}" fill="#38bdf8" font-size="9">${labelA}</text>
      <text x="${62 + labelA.length * 7 + 10}" y="${dpsGraphTop + 10}" fill="#f97316" font-size="9">${labelB}</text>
      ${toPoints(dpsA, '#38bdf8')}
      ${toPoints(dpsB, '#f97316')}
      ${hoverLines(dpsA, '#38bdf8', labelA)}
      ${hoverLines(dpsB, '#f97316', labelB)}
      ${hitPoints(dpsA, '#38bdf8', labelA)}
      ${hitPoints(dpsB, '#f97316', labelB)}
    </svg>${buildFreeDpsMask()}`;
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
    if (hasDebuffLaneA) lines.push({ key: 'a_debuff', owner: 'a', type: 'debuff', top: laneTop.a_debuff + 10 });
    if (hasDebuffLaneB) lines.push({ key: 'b_debuff', owner: 'b', type: 'debuff', top: laneTop.b_debuff + 10 });
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

  const getCastLabel = (record) => {
    if (state.lang === 'ja') return record.labelJa || record.label || record.actionJa || record.action || '-';
    return record.labelEn || record.actionEn || record.action || record.label || '-';
  };

  const buildBossLane = (casts, laneTopY) => {
    if (!casts.length) return '';
    const barTop = laneTopY + 2;
    const bars = casts.map((record) => {
      const start = Number(record.t || 0);
      const end = Math.max(start + 0.1, Number(record.endT || record.castEndT || start + 2));
      const x = 60 + start * pxPerSec;
      const w = Math.max(18, (end - start) * pxPerSec);
      const label = getCastLabel(record);
      const source = record.sourceName ? ` / ${record.sourceName}` : '';
      const title = `${formatTimelineTime(start)}-${formatTimelineTime(end)} ${label}${source}`;
      return `<div class="boss-cast-bar ${record.owner}" style="left:${x}px; top:${barTop}px; width:${w}px" title="${escapeHtml(title)}"><span>${escapeHtml(label)}</span></div>`;
    }).join('');
    return `<div class="boss-cast-lane-line" style="top:${laneTopY + 14}px"></div>
      ${bars}`;
  };

  const buildAddLane = (casts, laneTopY) => {
    if (!casts.length) return '';
    const barTop = laneTopY + 2;
    const bars = casts.map((record) => {
      const start = Number(record.t || 0);
      const end = Math.max(start + 0.1, Number(record.endT || record.castEndT || start + 2));
      const x = 60 + start * pxPerSec;
      const w = Math.max(18, (end - start) * pxPerSec);
      const label = getCastLabel(record);
      const source = record.sourceName ? ` / ${record.sourceName}` : '';
      const title = `${formatTimelineTime(start)}-${formatTimelineTime(end)} ${label}${source}`;
      return `<div class="boss-cast-bar add ${record.owner}" style="left:${x}px; top:${barTop}px; width:${w}px" title="${escapeHtml(title)}"><span>${escapeHtml(label)}</span></div>`;
    }).join('');
    return bars;
  };

  const buildAllBossCastLanes = () => {
    const buildGroup = (laneGroup, laneTops) => {
      if (!laneGroup.hasAnyLane) return '';
      return [
        buildAddLane(laneGroup.addCasts, laneTops.addTop),
        buildBossLane(laneGroup.bossCasts, laneTops.bossTop),
      ].join('');
    };
    return [
      buildGroup(castLanesA, castLaneTopsA),
      buildGroup(castLanesB, castLaneTopsB),
    ].join('');
  };

  const buildDebuffLane = (records, owner) => {
    if (!records.length) return '';
    const top = laneTop[`${owner}_debuff`];
    return `<div class="lane-label" style="top:${top - 14}px">${state.lang === 'ja' ? 'デバフ' : 'Debuff'}</div>
      ${records.map((record) => {
        const start = Number(record.t || 0);
        const end = Math.max(start + 0.1, Number(record.endT || start + 30));
        const x = 60 + start * pxPerSec;
        const w = Math.max(28, (end - start) * pxPerSec);
        const label = record.label || record.action || '-';
        const color = record.color || '#f87171';
        const title = `${formatTimelineTime(start)}-${formatTimelineTime(end)} ${label}`;
        return `<div class="player-debuff-segment ${owner}" style="left:${x}px; top:${top}px; width:${w}px; --debuff-color:${color};" title="${escapeHtml(title)}"><span>${escapeHtml(label)}</span></div>`;
      }).join('')}`;
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
      ${buildAllBossCastLanes()}
      ${buildTimelineGrid()}
      ${buildRulerAtTop()}
      <div class="player-label player-label-a" style="top:${laneTop.a_ogcd - 7}px">${labelA}</div>
      <div class="lane-label" style="top:${laneTop.a_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track a" style="top:${trackATop}px; height:${trackAHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.a_gcd + 12}px">${t('laneGcd')}</div>
      ${showSynergyLane ? `<div class="lane-label" style="top:${laneTop.a_synergy - 14}px">${t('laneSynergy')}</div>` : ''}
      ${buildSynergyLaneLabels(synergyLaneDefsA, 'a')}
      ${buildBuffOverlays(a, 'a')}
      ${buildSynergyLane(synergiesA, 'a', synergyLaneDefsA)}
      ${buildDebuffLane(playerDebuffsA, 'a')}
      <div class="player-divider" style="top:${dividerTop}px"></div>
      <div class="player-label player-label-b" style="top:${laneTop.b_ogcd - 7}px">${labelB}</div>
      <div class="lane-label" style="top:${laneTop.b_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track b" style="top:${trackBTop}px; height:${trackBHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.b_gcd + 12}px">${t('laneGcd')}</div>
      ${showSynergyLane ? `<div class="lane-label" style="top:${laneTop.b_synergy - 14}px">${t('laneSynergy')}</div>` : ''}
      ${buildSynergyLaneLabels(synergyLaneDefsB, 'b')}
      ${buildLaneGuides()}
      ${buildBuffOverlays(b, 'b')}
      ${buildSynergyLane(synergiesB, 'b', synergyLaneDefsB)}
      ${buildDebuffLane(playerDebuffsB, 'b')}
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

function renderPartyTimeline() {
  const wrap = el.timelineWrap;
  if (!wrap) return;
  const phaseA = getCurrentPhaseWindow('a');
  const phaseB = getCurrentPhaseWindow('b');
  const fightEndA = getFightDurationSec(state.fightA);
  const fightEndB = getFightDurationSec(state.fightB);
  const filterRecords = (records, owner) => {
    let filtered = filterTimeline(records || [], state.currentTab);
    const phase = owner === 'b' ? phaseB : phaseA;
    if (phase) filtered = filtered.filter((record) => record.t >= phase.startT && record.t < phase.endT);
    return filtered;
  };
  const showCastLane = Boolean(state.isPremium && state.showCastTimeline !== false);
  const bossCastRecordsA = showCastLane ? filterRecords(state.bossCastsA, 'a') : [];
  const bossCastRecordsB = showCastLane ? filterRecords(state.bossCastsB, 'b') : [];
  const buildPartyCastLaneGroup = (records, owner) => {
    const casts = (records || []).map((record) => ({ ...record, owner }));
    const bossCasts = casts.filter((record) => record.isBoss !== false);
    const addCasts = casts.filter((record) => record.isBoss === false);
    const hasBossLane = bossCasts.length > 0;
    const hasAddLane = addCasts.length > 0;
    const hasAnyLane = hasBossLane || hasAddLane;
    const totalHeight =
      (hasAddLane ? 30 + 6 : 0) +
      (hasBossLane ? 32 + 6 : 0);
    return { bossCasts, addCasts, hasBossLane, hasAddLane, hasAnyLane, totalHeight };
  };
  const castLanesA = buildPartyCastLaneGroup(bossCastRecordsA, 'a');
  const castLanesB = buildPartyCastLaneGroup(bossCastRecordsB, 'b');
  const partyFilter = ['th', 'dps', 'custom'].includes(state.partyTimelineFilter) ? state.partyTimelineFilter : 'all';
  const customPlayerIdsA = new Set((state.partyTimelineCustomPlayerIdsA || []).map((id) => String(id || '')).filter(Boolean));
  const customPlayerIdsB = new Set((state.partyTimelineCustomPlayerIdsB || []).map((id) => String(id || '')).filter(Boolean));
  const getRowJob = (row) => String(row?.player?.job || '').toUpperCase();
  const getRowPlayerId = (row) => String(row?.player?.id || '');
  const hasCustomPlayerSelection = customPlayerIdsA.size || customPlayerIdsB.size;
  const rowMatchesPartyFilter = (row, owner) => {
    if (partyFilter === 'all') return true;
    const job = getRowJob(row);
    const role = JOB_ROLE[job] || '';
    if (partyFilter === 'th') return role === 'T' || role === 'H';
    if (partyFilter === 'dps') return role === 'D';
    if (partyFilter === 'custom') {
      const ids = owner === 'b' ? customPlayerIdsB : customPlayerIdsA;
      return ids.has(getRowPlayerId(row));
    }
    return true;
  };
  const mapRows = (rows, owner) => (rows || [])
    .filter((row) => rowMatchesPartyFilter(row, owner))
    .map((row) => ({ ...row, records: filterRecords(row.records, owner) }));
  const rowsA = mapRows(state.partyTimelineA, 'a');
  const rowsB = mapRows(state.partyTimelineB, 'b');
  const visibleIdsA = new Set(rowsA.map((row) => Number(row?.player?.id || 0)).filter(Boolean));
  const visibleIdsB = new Set(rowsB.map((row) => Number(row?.player?.id || 0)).filter(Boolean));
  const maxT = Math.max(
    1,
    fightEndA,
    fightEndB,
    ...rowsA.flatMap((row) => row.records.map((record) => record.t)),
    ...rowsB.flatMap((row) => row.records.map((record) => record.t)),
    ...bossCastRecordsA.map((record) => Number(record.endT || record.t || 0)),
    ...bossCastRecordsB.map((record) => Number(record.endT || record.t || 0)),
  );
  const pxPerSec = 16 * state.zoom;
  const labelWidth = 172;
  const xStart = labelWidth + 10;
  const width = Math.max(1800, maxT * pxPerSec + xStart + 160);
  const controlLeft = 8;
  const controlWidth = xStart - controlLeft - 10;
  const rulerTop = 8;
  const groupLabelGap = 26;
  const rowHeight = 40;
  const graphHeight = 82;
  const freeDpsPreviewSec = 30;
  const assignCastLaneTops = (laneGroup, areaTop) => {
    let offset = areaTop;
    const addTop = laneGroup.hasAddLane ? offset : 0;
    if (laneGroup.hasAddLane) offset += 30 + 6;
    const bossTop = laneGroup.hasBossLane ? offset : 0;
    return { addTop, bossTop };
  };
  const castAreaTopA = rulerTop + 28;
  const castLaneTopsA = assignCastLaneTops(castLanesA, castAreaTopA);
  const rowTopA = castAreaTopA + castLanesA.totalHeight + (castLanesA.hasAnyLane ? 8 : 0) + groupLabelGap;
  const graphTop = rowTopA + rowsA.length * rowHeight + 24;
  const castAreaTopB = graphTop + graphHeight + 34;
  const castLaneTopsB = assignCastLaneTops(castLanesB, castAreaTopB);
  const rowTopB = castAreaTopB + castLanesB.totalHeight + (castLanesB.hasAnyLane ? 8 : 0) + groupLabelGap;
  const totalHeight = rowTopB + rowsB.length * rowHeight + 26;
  const controlPanelHeight = 58;
  const controlStackTop = graphTop + Math.max(0, (graphHeight - controlPanelHeight) / 2);

  const buildGrid = () => {
    const parts = [];
    for (let sec = 0; sec <= Math.ceil(maxT); sec++) {
      const x = xStart + sec * pxPerSec;
      const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
      const label = sec % 5 === 0 ? `<span>${formatTimelineTime(sec)}</span>` : '';
      parts.push(`<div class="timeline-grid-line ${level}" style="left:${x}px; top:${rulerTop}px; height:${totalHeight - rulerTop}px"></div>`);
      parts.push(`<div class="tick ${level}" style="left:${x}px; top:${rulerTop}px">${label}</div>`);
    }
    return parts.join('');
  };

  const buildRowEvents = (records, top) => {
    const lastBySlot = new Map();
    const minGap = 14;
    return records.map((record) => {
      const baseX = xStart + record.t * pxPerSec;
      const slot = Math.floor(record.t * 2);
      const lastX = lastBySlot.get(slot) ?? -999;
      const x = Math.max(baseX, lastX + minGap);
      lastBySlot.set(slot, x);
      const icon = record.icon || '';
      const candidates = (record.iconCandidates || []).join('|');
      const fallback = (record.label || record.action || '?').slice(0, 2).toUpperCase();
      const title = `${formatTimelineTime(record.t)} ${record.label || record.action}`;
      return `<div class="pt-event" style="left:${x}px; top:${top}px" title="${title}">${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${record.label || record.action}" />` : `<span>${fallback}</span>`}</div>`;
    }).join('');
  };

  const getCastLabel = (record) => {
    if (state.lang === 'ja') return record.labelJa || record.label || record.actionJa || record.action || '-';
    return record.labelEn || record.actionEn || record.action || record.label || '-';
  };

  const buildPartyCastBars = (casts, laneTop, isAdd = false) => {
    if (!casts.length) return '';
    const barTop = laneTop + 2;
    const line = isAdd ? '' : `<div class="boss-cast-lane-line" style="top:${laneTop + 14}px"></div>`;
    const bars = casts.map((record) => {
      const start = Number(record.t || 0);
      const end = Math.max(start + 0.1, Number(record.endT || record.castEndT || start + 2));
      const x = xStart + start * pxPerSec;
      const w = Math.max(18, (end - start) * pxPerSec);
      const label = getCastLabel(record);
      const source = record.sourceName ? ` / ${record.sourceName}` : '';
      const title = `${formatTimelineTime(start)}-${formatTimelineTime(end)} ${label}${source}`;
      return `<div class="boss-cast-bar ${isAdd ? 'add ' : ''}${record.owner}" style="left:${x}px; top:${barTop}px; width:${w}px" title="${escapeHtml(title)}"><span>${escapeHtml(label)}</span></div>`;
    }).join('');
    return `${line}${bars}`;
  };

  const buildPartyCastLanes = (laneGroup, laneTops) => {
    if (!laneGroup.hasAnyLane) return '';
    return [
      buildPartyCastBars(laneGroup.addCasts, laneTops.addTop, true),
      buildPartyCastBars(laneGroup.bossCasts, laneTops.bossTop, false),
    ].join('');
  };

  const filterGraphPoints = (points, valueKey, owner) => {
    let filtered = (points || []).filter((point) => Number.isFinite(Number(point?.t)) && Number.isFinite(Number(point?.[valueKey])));
    const phase = owner === 'b' ? phaseB : phaseA;
    if (phase) filtered = filtered.filter((point) => point.t >= phase.startT && point.t <= phase.endT);
    if (state.currentTab === 'odd' || state.currentTab === 'even') {
      filtered = filtered.filter((point) => isInTimelineFocusWindow(point.t, state.currentTab));
    }
    return filtered;
  };

  const filterPartyDamageByVisibleRows = (events, visibleIds) => {
    if (partyFilter === 'all' || !visibleIds.size) return events || [];
    return (events || []).filter((event) => visibleIds.has(Number(event?.sourceId || 0)));
  };

  const buildPartyDpsGraph = () => {
    const damageA = filterPartyDamageByVisibleRows(state.partyDamageA || [], visibleIdsA);
    const damageB = filterPartyDamageByVisibleRows(state.partyDamageB || [], visibleIdsB);
    const sourceA = partyFilter === 'all' ? (state.partyRollingDpsA || []) : computeRollingDps(damageA, maxT);
    const sourceB = partyFilter === 'all' ? (state.partyRollingDpsB || []) : computeRollingDps(damageB, maxT);
    const dpsA = filterGraphPoints(sourceA, 'dps', 'a');
    const dpsB = filterGraphPoints(sourceB, 'dps', 'b');
    if (!dpsA.length && !dpsB.length) return '';
    const buildFreeDpsMask = () => {
      if (state.isPremium || maxT <= freeDpsPreviewSec) return '';
      const maskLeft = xStart + freeDpsPreviewSec * pxPerSec;
      const maskWidth = Math.max(0, (maxT - freeDpsPreviewSec) * pxPerSec);
      const title = state.lang === 'ja' ? '\u0033\u0030\u79d2\u4ee5\u964d\u306e\u0050\u0054\u0020\u0044\u0050\u0053\u63a8\u79fb\u306f\u30b5\u30dd\u30fc\u30bf\u30fc\u5411\u3051\u3067\u3059' : 'Party DPS after 30s is a Supporter feature';
      const body = state.lang === 'ja'
        ? '\u6700\u521d\u306e\u0033\u0030\u79d2\u306f\u7121\u6599\u3067\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002\u4ee5\u964d\u306e\u63a8\u79fb\u3092\u78ba\u8a8d\u3059\u308b\u306b\u306f\u30b5\u30dd\u30fc\u30bf\u30fc\u767b\u9332\u3092\u3054\u5229\u7528\u304f\u3060\u3055\u3044\u3002'
        : 'The first 30 seconds are visible for free. Register as a Supporter to inspect the rest of the graph.';
      const href = state.lang === 'en' ? '/premium.html?feature=dps-graph&lang=en' : '/premium.html?feature=dps-graph';
      const cta = state.lang === 'ja' ? '\u30b5\u30dd\u30fc\u30bf\u30fc\u7279\u5178\u3092\u898b\u308b' : 'View benefits';
      return `<div class="dps-supporter-mask party" style="left:${maskLeft}px; top:${graphTop}px; width:${maskWidth}px; height:${graphHeight}px">
        <div><strong>${title}</strong><span>${body}</span></div>
        <a href="${href}">${cta}</a>
      </div>`;
    };
    const maxDps = Math.max(...dpsA.map((point) => point.dps), ...dpsB.map((point) => point.dps), 1);
    const plotHeight = graphHeight - 18;
    const yBase = graphTop + plotHeight + 8;
    const points = (values) => values.map((point) => {
      const x = xStart + point.t * pxPerSec;
      const y = yBase - (point.dps / maxDps) * plotHeight;
      return `${x},${y}`;
    }).join(' ');
    const hitPoints = (values, color, label) => values.map((point) => {
      const x = xStart + point.t * pxPerSec;
      const y = yBase - (point.dps / maxDps) * plotHeight;
      const tooltip = `${label} ${formatTimelineTimeShared(point.t)} DPS: ${Math.round(point.dps).toLocaleString()}`;
      return `<circle class="dps-graph-hit" cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0.01"><title>${escapeHtml(tooltip)}</title></circle>`;
    }).join('');
    const hoverLines = (values, color, label) => {
      if (values.length < 2) return '';
      const parts = [];
      for (let i = 1; i < values.length; i += 1) {
        const prev = values[i - 1];
        const point = values[i];
        const x1 = xStart + prev.t * pxPerSec;
        const y1 = yBase - (prev.dps / maxDps) * plotHeight;
        const x2 = xStart + point.t * pxPerSec;
        const y2 = yBase - (point.dps / maxDps) * plotHeight;
        const tooltip = `${label} ${formatTimelineTimeShared(point.t)} DPS: ${Math.round(point.dps).toLocaleString()}`;
        parts.push(`<line class="dps-graph-hover-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="18" opacity="0"><title>${escapeHtml(tooltip)}</title></line>`);
      }
      return parts.join('');
    };
    const maxLabel = maxDps >= 1000 ? `${Math.round(maxDps / 1000)}k` : String(Math.round(maxDps));
    return `<svg class="pt-dps-graph" style="position:absolute; left:0; top:0; width:${width}px; height:${totalHeight}px; pointer-events:auto; overflow:visible;">
      <rect x="${xStart}" y="${graphTop}" width="${maxT * pxPerSec}" height="${graphHeight}" rx="6" fill="rgba(15, 23, 42, 0.48)" stroke="rgba(105, 146, 185, 0.14)" />
      <text x="${xStart + 8}" y="${graphTop + 14}" fill="#94a3b8" font-size="10">PT DPS</text>
      <text x="${xStart + 60}" y="${graphTop + 14}" fill="#38bdf8" font-size="10">Log A</text>
      <text x="${xStart + 104}" y="${graphTop + 14}" fill="#f97316" font-size="10">Log B</text>
      <text x="${xStart - 6}" y="${graphTop + 14}" text-anchor="end" fill="#64748b" font-size="9">${maxLabel}</text>
      ${dpsA.length ? `<polyline points="${points(dpsA)}" fill="none" stroke="#38bdf8" stroke-width="1.6" opacity="0.86" />` : ''}
      ${dpsB.length ? `<polyline points="${points(dpsB)}" fill="none" stroke="#f97316" stroke-width="1.6" opacity="0.86" />` : ''}
      ${hoverLines(dpsA, '#38bdf8', 'Log A')}
      ${hoverLines(dpsB, '#f97316', 'Log B')}
      ${hitPoints(dpsA, '#38bdf8', 'Log A')}
      ${hitPoints(dpsB, '#f97316', 'Log B')}
    </svg>${buildFreeDpsMask()}`;
  };

  const buildPartyFilterControls = () => {
    const modes = [
      ['all', '全員'],
      ['th', 'TH'],
      ['dps', 'DPS'],
      ['custom', 'カスタム'],
    ];
    return `<div class="pt-filter-controls" style="left:${controlLeft}px; top:${controlStackTop}px; width:${controlWidth}px; height:${controlPanelHeight}px">
      <div class="pt-control-label">絞り込み</div>
      ${modes.map(([mode, label]) => `<button type="button" class="pt-filter-btn ${partyFilter === mode ? 'active' : ''}" data-party-filter="${mode}">${label}</button>`).join('')}
    </div>`;
  };

  const buildCustomPlayerList = (rows, owner) => {
    const selectedIds = owner === 'b' ? customPlayerIdsB : customPlayerIdsA;
    const defaultChecked = partyFilter !== 'custom' && !hasCustomPlayerSelection;
    return (rows || []).map((row) => {
      const id = getRowPlayerId(row);
      const job = row.player?.job ? formatJobName(row.player.job) : '';
      const name = row.player?.name || '-';
      const checked = defaultChecked || selectedIds.has(id) ? ' checked' : '';
      return `<label class="pt-custom-player">
        <input type="checkbox" data-custom-owner="${owner}" data-custom-player-id="${escapeHtml(id)}"${checked}>
        <span class="pt-custom-job">${escapeHtml(job || '-')}</span>
        <span class="pt-custom-name">${escapeHtml(name)}</span>
      </label>`;
    }).join('');
  };

  const buildCustomFilterModal = () => {
    if (!state.partyTimelineCustomModalOpen) return '';
    return `<div class="pt-custom-backdrop" data-custom-action="cancel"></div>
      <div class="pt-custom-modal" role="dialog" aria-modal="true" aria-label="カスタム絞り込み">
        <div class="pt-custom-head">
          <div>
            <div class="pt-custom-title">カスタム絞り込み</div>
            <div class="pt-custom-sub">表示するプレイヤーを選択</div>
          </div>
          <button type="button" class="pt-custom-close" data-custom-action="cancel" aria-label="閉じる">×</button>
        </div>
        <div class="pt-custom-grid">
          <div class="pt-custom-side">
            <div class="pt-custom-side-title a">Log A</div>
            ${buildCustomPlayerList(state.partyTimelineA, 'a')}
          </div>
          <div class="pt-custom-side">
            <div class="pt-custom-side-title b">Log B</div>
            ${buildCustomPlayerList(state.partyTimelineB, 'b')}
          </div>
        </div>
        <div class="pt-custom-actions">
          <button type="button" class="pt-custom-secondary" data-custom-action="all">全員選択</button>
          <button type="button" class="pt-custom-secondary" data-custom-action="clear">解除</button>
          <button type="button" class="pt-custom-secondary" data-custom-action="cancel">キャンセル</button>
          <button type="button" class="pt-custom-primary" data-custom-action="apply">適用</button>
        </div>
      </div>`;
  };

  const buildRows = (rows, owner, startTop) => rows.map((row, index) => {
    const top = startTop + index * rowHeight;
    const job = row.player?.job ? formatJobName(row.player.job) : '';
    const label = `${job ? `${job} ` : ''}${row.player?.name || '-'}`;
    return `
      <div class="pt-row-label" style="top:${top + 5}px" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
      <div class="pt-row-line ${owner}" style="top:${top + 15}px"></div>
      ${buildRowEvents(row.records, top + 2)}
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="timeline pt-timeline" style="width:${width}px; height:${totalHeight}px">
      ${buildGrid()}
      ${buildPartyCastLanes(castLanesA, castLaneTopsA)}
      <div class="pt-group-label a" style="top:${rowTopA - groupLabelGap}px">Log A</div>
      ${buildRows(rowsA, 'a', rowTopA)}
      ${buildPartyDpsGraph()}
      ${buildPartyFilterControls()}
      <div class="player-divider" style="top:${rowTopB - groupLabelGap - 14}px"></div>
      ${buildPartyCastLanes(castLanesB, castLaneTopsB)}
      <div class="pt-group-label b" style="top:${rowTopB - groupLabelGap}px">Log B</div>
      ${buildRows(rowsB, 'b', rowTopB)}
      ${buildCustomFilterModal()}
    </div>
  `;
  wrap.querySelectorAll('img.event-icon').forEach(img => {
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
      img.replaceWith(Object.assign(document.createElement('span'), { textContent: (img.alt || '?').slice(0, 2).toUpperCase() }));
    });
  });
  wrap.querySelectorAll('[data-party-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = ['all', 'th', 'dps', 'custom'].includes(button.dataset.partyFilter)
        ? button.dataset.partyFilter
        : 'all';
      if (mode === 'custom') {
        state.partyTimelineCustomModalOpen = true;
        renderPartyTimeline();
        return;
      }
      state.partyTimelineFilter = mode;
      state.partyTimelineCustomModalOpen = false;
      renderPartyTimeline();
    });
  });
  wrap.querySelectorAll('[data-custom-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.customAction;
      const checkboxes = [...wrap.querySelectorAll('[data-custom-player-id]')];
      if (action === 'all') {
        checkboxes.forEach((checkbox) => { checkbox.checked = true; });
        return;
      }
      if (action === 'clear') {
        checkboxes.forEach((checkbox) => { checkbox.checked = false; });
        return;
      }
      if (action === 'cancel') {
        state.partyTimelineCustomModalOpen = false;
        renderPartyTimeline();
        return;
      }
      if (action === 'apply') {
        state.partyTimelineCustomPlayerIdsA = checkboxes
          .filter((checkbox) => checkbox.checked && checkbox.dataset.customOwner === 'a')
          .map((checkbox) => checkbox.dataset.customPlayerId);
        state.partyTimelineCustomPlayerIdsB = checkboxes
          .filter((checkbox) => checkbox.checked && checkbox.dataset.customOwner === 'b')
          .map((checkbox) => checkbox.dataset.customPlayerId);
        state.partyTimelineFilter = 'custom';
        state.partyTimelineCustomModalOpen = false;
        renderPartyTimeline();
      }
    });
  });
  bindTimelineInteractions();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function scrollTimelineToTabFocus() {
  if (!el.timelineWrap) return;
  const tab = state.currentTab;
  if (tab === 'all') {
    el.timelineWrap.scrollTo?.({ left: 0, behavior: 'smooth' });
    return;
  }
  const targetSec = tab === 'odd' ? 50 : 110;
  const pxPerSec = 16 * state.zoom;
  const xStart = state.timelineView === 'party' ? 182 : 60;
  const left = Math.max(0, xStart + targetSec * pxPerSec);
  el.timelineWrap.scrollTo?.({ left, behavior: 'smooth' });
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
  renderPartyTimeline,
  renderTimeline,
  removeKnownNonDamageFollowupCasts,
  scrollTimelineToPhase,
  scrollTimelineToTabFocus,
});
