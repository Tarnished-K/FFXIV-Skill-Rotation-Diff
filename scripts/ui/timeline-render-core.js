// Timeline rendering and interaction wiring
const {
  findBurstBuff,
  findSelfBuff,
  findTinctureBuff,
  getActiveSynergies,
} = globalThis;
const {
  formatHitType: coreFormatHitType,
  formatTimelineTime: coreFormatTimelineTime,
} = globalThis.TimelineUtils;

function getCurrentPhaseWindow(owner) {
  if (!state.currentPhase) return null;
  return owner === 'b'
    ? (state.currentPhase.b || state.currentPhase.a || null)
    : (state.currentPhase.a || state.currentPhase.b || null);
}

function filterTimelineByPhase(records, owner) {
  const phase = getCurrentPhaseWindow(owner);
  if (!phase) return records;
  return records.filter((record) => record.t >= phase.startT && record.t < phase.endT);
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
    ...a.map((entry) => entry.t),
    ...b.map((entry) => entry.t),
  );
  const pxPerSec = 16 * state.zoom;
  const width = Math.max(1800, maxT * pxPerSec + 220);
  const labelA = state.selectedA?.name || 'A';
  const labelB = state.selectedB?.name || 'B';
  const escapeAttr = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const hasDps = state.rollingDpsA.length > 0 || state.rollingDpsB.length > 0;
  const canShowDpsGraph = Boolean(state.isPremium);
  const freeDpsPreviewSec = 30;
  const dpsGraphHeight = hasDps ? 80 : 0;
  const dpsGraphTop = hasDps ? 4 : 0;
  const rulerTop = dpsGraphTop + dpsGraphHeight;
  const playerAStart = rulerTop + 18;
  const laneTop = {
    a_ogcd: playerAStart + 10,
    a_gcd: playerAStart + 64,
    b_ogcd: 0,
    b_gcd: 0,
  };
  const trackATop = playerAStart;
  const trackAHeight = 110;
  const dividerTop = trackATop + trackAHeight + 10;
  const trackBTop = dividerTop + 18;
  const trackBHeight = 110;
  laneTop.b_ogcd = trackBTop + 10;
  laneTop.b_gcd = trackBTop + 64;
  const totalHeight = trackBTop + trackBHeight + 20;

  const isGcd = (record) => record.category === 'weaponskill' || record.category === 'spell';

  const buildDpsGraph = () => {
    if (!hasDps) return '';
    const buildFreeDpsMask = () => {
      if (canShowDpsGraph || maxT <= freeDpsPreviewSec) return '';
      const maskLeft = 60 + freeDpsPreviewSec * pxPerSec;
      const maskWidth = Math.max(0, (maxT - freeDpsPreviewSec) * pxPerSec);
      const title = state.lang === 'ja' ? '\u0033\u0030\u79d2\u4ee5\u964d\u306e\u0044\u0050\u0053\u63a8\u79fb\u306f\u30b5\u30dd\u30fc\u30bf\u30fc\u5411\u3051\u3067\u3059' : 'DPS after 30s is a Supporter feature';
      const body = state.lang === 'ja'
        ? '\u6700\u521d\u306e\u0033\u0030\u79d2\u306f\u7121\u6599\u3067\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002\u4ee5\u964d\u306e\u63a8\u79fb\u3092\u78ba\u8a8d\u3059\u308b\u306b\u306f\u30b5\u30dd\u30fc\u30bf\u30fc\u767b\u9332\u3092\u3054\u5229\u7528\u304f\u3060\u3055\u3044\u3002'
        : 'The first 30 seconds are visible for free. Register as a Supporter to inspect the rest of the graph.';
      const href = state.lang === 'en' ? '/premium.html?feature=dps-graph&lang=en' : '/premium.html?feature=dps-graph';
      const cta = state.lang === 'ja' ? '\u30b5\u30dd\u30fc\u30bf\u30fc\u7279\u5178\u3092\u898b\u308b' : 'View benefits';
      return `<div class="dps-supporter-mask" style="left:${maskLeft}px; top:${dpsGraphTop}px; width:${maskWidth}px; height:${dpsGraphHeight - 10}px">
        <div><strong>${title}</strong><span>${body}</span></div>
        <a href="${href}">${cta}</a>
      </div>`;
    };
    let dpsA = state.rollingDpsA;
    let dpsB = state.rollingDpsB;
    if (phaseA) dpsA = dpsA.filter((entry) => entry.t >= phaseA.startT && entry.t <= phaseA.endT);
    if (phaseB) dpsB = dpsB.filter((entry) => entry.t >= phaseB.startT && entry.t <= phaseB.endT);
    if (state.currentTab === 'odd') {
      dpsA = dpsA.filter((entry) => Math.floor(entry.t / 60) % 2 === 1);
      dpsB = dpsB.filter((entry) => Math.floor(entry.t / 60) % 2 === 1);
    } else if (state.currentTab === 'even') {
      dpsA = dpsA.filter((entry) => Math.floor(entry.t / 60) % 2 === 0 && entry.t >= 60);
      dpsB = dpsB.filter((entry) => Math.floor(entry.t / 60) % 2 === 0 && entry.t >= 60);
    }
    const maxDps = Math.max(...dpsA.map((point) => point.dps), ...dpsB.map((point) => point.dps), 1);
    const graphHeight = dpsGraphHeight - 10;
    const toPoints = (points, color) => {
      if (!points.length) return '';
      const coords = points.map((point) => {
        const x = 60 + point.t * pxPerSec;
        const y = dpsGraphTop + graphHeight - (point.dps / maxDps) * (graphHeight - 5);
        return `${x},${y}`;
      }).join(' ');
      return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.8" />`;
    };
    const toHitPoints = (points, color, label) => {
      if (!points.length) return '';
      return points.map((point) => {
        const x = 60 + point.t * pxPerSec;
        const y = dpsGraphTop + graphHeight - (point.dps / maxDps) * (graphHeight - 5);
        const tooltip = `${label} ${coreFormatTimelineTime(point.t)} DPS: ${Math.round(point.dps).toLocaleString()}`;
        return `<circle class="dps-graph-hit" cx="${x}" cy="${y}" r="12" fill="${color}" opacity="0.01"><title>${escapeAttr(tooltip)}</title></circle>`;
      }).join('');
    };
    const toHoverLines = (points, color, label) => {
      if (points.length < 2) return '';
      const parts = [];
      for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const point = points[i];
        const x1 = 60 + prev.t * pxPerSec;
        const y1 = dpsGraphTop + graphHeight - (prev.dps / maxDps) * (graphHeight - 5);
        const x2 = 60 + point.t * pxPerSec;
        const y2 = dpsGraphTop + graphHeight - (point.dps / maxDps) * (graphHeight - 5);
        const tooltip = `${label} ${coreFormatTimelineTime(point.t)} DPS: ${Math.round(point.dps).toLocaleString()}`;
        parts.push(`<line class="dps-graph-hover-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="18" opacity="0"><title>${escapeAttr(tooltip)}</title></line>`);
      }
      return parts.join('');
    };
    const labels = [];
    for (let i = 0; i <= 2; i += 1) {
      const dps = maxDps * i / 2;
      const y = dpsGraphTop + graphHeight - (dps / maxDps) * (graphHeight - 5);
      const label = dps >= 1000 ? `${(dps / 1000).toFixed(0)}k` : dps.toFixed(0);
      labels.push(`<text x="55" y="${y + 3}" text-anchor="end" fill="#64748b" font-size="9">${label}</text>`);
    }
    return `<svg class="dps-graph-svg" style="position:absolute; left:0; top:0; width:${width}px; height:${dpsGraphTop + dpsGraphHeight}px; pointer-events:auto; overflow:visible;">
      <rect x="60" y="${dpsGraphTop}" width="${maxT * pxPerSec}" height="${graphHeight}" fill="#0f172a" rx="4" opacity="0.5" />
      ${labels.join('')}
      <text x="62" y="${dpsGraphTop + 10}" fill="#38bdf8" font-size="9">${labelA}</text>
      <text x="${62 + labelA.length * 7 + 10}" y="${dpsGraphTop + 10}" fill="#f97316" font-size="9">${labelB}</text>
      ${toPoints(dpsA, '#38bdf8')}
      ${toPoints(dpsB, '#f97316')}
      ${toHoverLines(dpsA, '#38bdf8', labelA)}
      ${toHoverLines(dpsB, '#f97316', labelB)}
      ${toHitPoints(dpsA, '#38bdf8', labelA)}
      ${toHitPoints(dpsB, '#f97316', labelB)}
    </svg>`;
  };

  const buildRulerAtTop = () => {
    const marks = [];
    for (let sec = 0; sec <= Math.ceil(maxT); sec += 1) {
      const x = 60 + sec * pxPerSec;
      const level = sec % 10 === 0 ? 'ten' : sec % 5 === 0 ? 'five' : 'one';
      const label = sec % 5 === 0 ? `<span>${coreFormatTimelineTime(sec)}</span>` : '';
      marks.push(`<div class="tick ${level}" style="left:${x}px; top:${rulerTop}px">${label}</div>`);
    }
    return marks.join('');
  };

  const buildBuffOverlays = (records, owner) => {
    const overlays = [];
    const baseTop = owner === 'a' ? trackATop : trackBTop;
    const height = owner === 'a' ? trackAHeight : trackBHeight;
    for (const record of records) {
      const buff = findBurstBuff(record.actionId, record.action) || findSelfBuff(record.action) || findTinctureBuff(record.action);
      if (!buff) continue;
      const x = 60 + record.t * pxPerSec;
      const widthPx = buff.duration * pxPerSec;
      const label = state.lang === 'ja' ? buff.nameJa : buff.nameEn;
      overlays.push(`<div class="burst-overlay" style="left:${x}px; top:${baseTop}px; width:${widthPx}px; height:${height}px; background:${buff.color}20; border-left:2px solid ${buff.color}60;"><span class="burst-label" style="color:${buff.color}">${label}</span></div>`);
    }
    return overlays.join('');
  };

  const buildPhaseLines = () => {
    if (!state.phases || state.phases.length < 2) return '';
    const parts = [];
    for (const phase of state.phases.slice(1)) {
      if (phase.a) {
        const xA = 60 + phase.a.startT * pxPerSec;
        parts.push(`<div class="phase-divider a" style="left:${xA}px; top:${rulerTop}px; height:${dividerTop - rulerTop}px" title="A ${phase.label}: ${coreFormatTimelineTime(phase.a.startT)}"><span class="phase-divider-label">${phase.label}</span></div>`);
      }
      if (phase.b) {
        const xB = 60 + phase.b.startT * pxPerSec;
        parts.push(`<div class="phase-divider b" style="left:${xB}px; top:${dividerTop}px; height:${totalHeight - dividerTop}px" title="B ${phase.label}: ${coreFormatTimelineTime(phase.b.startT)}"><span class="phase-divider-label">${phase.label}</span></div>`);
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
      markers.push(`<div class="kill-divider ${row.owner}" style="left:${x}px; top:${row.top}px; height:${row.height}px" title="${label}: ${coreFormatTimelineTime(markerT)}"><span class="kill-divider-label">${label}</span></div>`);
    }
    return markers.join('');
  };

  const buildEvents = (records, owner, partyBuffs) => {
    const lanesLastX = { gcd: -999, ogcd: -999 };
    const minGap = 24;
    return records.map((record) => {
      const lane = isGcd(record) ? 'gcd' : 'ogcd';
      const baseX = 60 + record.t * pxPerSec;
      const x = Math.max(baseX, lanesLastX[lane] + minGap);
      lanesLastX[lane] = x;
      const icon = record.icon || '';
      const fallback = (record.label || record.action || '?').slice(0, 2).toUpperCase();
      const top = laneTop[`${owner}_${lane}`];
      const candidates = (record.iconCandidates || []).join('|');
      let tooltip = `${coreFormatTimelineTime(record.t)} ${record.label || record.action}`;
      if (record.damage != null && record.damage > 0) {
        tooltip += `\n${state.lang === 'ja' ? 'ダメージ' : 'Damage'}: ${record.damage.toLocaleString()}`;
        const hitType = coreFormatHitType(record.hitType, record.multistrike);
        if (hitType) tooltip += ` (${hitType})`;
      }
      const synergies = getActiveSynergies(record.t, records, partyBuffs);
      if (synergies.length) {
        tooltip += `\n${state.lang === 'ja' ? 'バフ' : 'Buffs'}: ${synergies.join(', ')}`;
      }
      return `<div class="event ${owner} ${lane}" style="left:${x}px; top:${top}px" title="${tooltip}">${icon ? `<img class="event-icon" src="${icon}" data-fallbacks="${candidates}" alt="${record.label || record.action}" />` : `<span>${fallback}</span>`}</div>`;
    }).join('');
  };

  el.timelineWrap.innerHTML = `
    <div class="timeline" style="width:${width}px; height:${totalHeight}px">
      ${buildDpsGraph()}
      ${buildRulerAtTop()}
      <div class="player-label player-label-a" style="top:${playerAStart - 4}px">${labelA}</div>
      <div class="lane-label" style="top:${laneTop.a_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track a" style="top:${trackATop}px; height:${trackAHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.a_gcd + 12}px">${t('laneGcd')}</div>
      ${buildBuffOverlays(a, 'a')}
      <div class="player-divider" style="top:${dividerTop}px"></div>
      <div class="player-label player-label-b" style="top:${dividerTop + 10}px">${labelB}</div>
      <div class="lane-label" style="top:${laneTop.b_ogcd + 12}px">${t('laneAbility')}</div>
      <div class="track b" style="top:${trackBTop}px; height:${trackBHeight}px"></div>
      <div class="lane-label" style="top:${laneTop.b_gcd + 12}px">${t('laneGcd')}</div>
      ${buildBuffOverlays(b, 'b')}
      ${buildEvents(a, 'a', state.partyBuffsA)}
      ${buildEvents(b, 'b', state.partyBuffsB)}
      ${buildPhaseLines()}
      ${buildKillLines()}
    </div>
  `;

  el.timelineWrap.querySelectorAll('img.event-icon').forEach((img) => {
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
      img.replaceWith(Object.assign(document.createElement('span'), {
        textContent: (img.alt || '?').slice(0, 2).toUpperCase(),
      }));
    });
  });

  bindTimelineInteractions();
}

Object.assign(globalThis, {
  bindTimelineInteractions,
  renderTimeline,
});
