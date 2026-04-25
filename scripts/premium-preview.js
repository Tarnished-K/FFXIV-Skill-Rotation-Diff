// Premium page: loads static preview JSON and renders a read-only comparison timeline.
// Mirrors the main app's HTML/CSS structure (timeline.js) for visual consistency.
(function PremiumPreview() {
  'use strict';

  const DATA_URL = './assets/premium-preview-data.json';
  const PX_PER_SEC = 40;   // matches app default zoom 2.5 (16 * 2.5)
  const X_OFF = 60;        // personal view: left gutter (matches main app)
  const X_OFF_PT = 182;    // party view: xStart = labelWidth(172) + 10

  // Personal view layout constants (mirrors timeline.js)
  const BOSS_BAR_TOP = 8;
  const BOSS_LANE_LINE_TOP = 34;
  const RULER_TOP = 44;
  const PLAYER_A_START_OFFSET = 18;  // from ruler bottom
  const OGCD_OFFSET = 10;
  const GCD_OFFSET = 64;
  const SYNERGY_OFFSET = 124;
  const SYNERGY_ROW_H = 12;
  const TRACK_MIN_H = 110;
  const DIVIDER_OFFSET = 16;   // from track bottom
  const PLAYER_B_GAP = 30;     // divider to player B

  // Party view
  const PT_ROW_H = 40;
  const PT_GROUP_LABEL_H = 26;

  // --- DOM helpers ---

  function el(tag, className) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function div(className) { return el('div', className); }

  function applyStyle(node, styles) {
    Object.assign(node.style, styles);
    return node;
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDps(dps) {
    return dps >= 1000 ? `${(dps / 1000).toFixed(1)}k` : String(Math.round(dps));
  }

  function isGcd(r) {
    if (r.category) return r.category === 'weaponskill' || r.category === 'spell';
    return r.castEndT != null && (r.castEndT - r.t) > 1.0;
  }

  function eventFallback(r) {
    return (r.label || r.action || '?').slice(0, 2).toUpperCase();
  }

  // --- Shared lane builders ---

  function buildGridAndTicks(maxSec, rulerTop, totalH, frag) {
    const lineH = totalH - rulerTop;
    for (let t = 0; t <= maxSec; t++) {
      const x = X_OFF + t * PX_PER_SEC;
      const cls = t % 10 === 0 ? 'ten' : t % 5 === 0 ? 'five' : 'one';

      const line = div(`timeline-grid-line ${cls}`);
      applyStyle(line, { left: `${x}px`, top: `${rulerTop}px`, height: `${lineH}px` });
      frag.appendChild(line);

      const tick = div(`tick ${cls}`);
      applyStyle(tick, { left: `${x}px`, top: `${rulerTop}px` });
      if (t % 5 === 0) {
        const label = document.createElement('span');
        label.textContent = formatTime(t);
        tick.appendChild(label);
      }
      frag.appendChild(tick);
    }
  }

  function buildBossCastBars(bossCasts, frag) {
    if (!bossCasts.length) return;
    const laneLine = div('boss-cast-lane-line');
    applyStyle(laneLine, { top: `${BOSS_LANE_LINE_TOP}px` });
    frag.appendChild(laneLine);

    for (const r of bossCasts) {
      const x = X_OFF + r.t * PX_PER_SEC;
      const w = Math.max(18, ((r.endT || r.t + 2) - r.t) * PX_PER_SEC);
      const label = r.actionJa || r.action || '';
      const bar = div(`boss-cast-bar a`);
      applyStyle(bar, { left: `${x}px`, top: `${BOSS_BAR_TOP + 4}px`, width: `${w}px` });
      bar.title = (r.sourceName ? r.sourceName + ': ' : '') + label;
      const sp = document.createElement('span');
      sp.textContent = label;
      bar.appendChild(sp);
      frag.appendChild(bar);
    }
  }

  function buildSynergyLanes(synergy, synergyTop, frag) {
    const laneKeys = [...new Set(synergy.map(r => r.nameEn))];
    const laneIdx = new Map(laneKeys.map((k, i) => [k, i]));
    const colorOf = new Map(synergy.map(r => [r.nameEn, r.color || '#f2cf7a']));

    // Lane name labels (left: 8px from CSS)
    for (const [key, i] of laneIdx) {
      const nm = div('synergy-lane-name');
      applyStyle(nm, { top: `${synergyTop + i * SYNERGY_ROW_H}px`, color: colorOf.get(key) });
      const rec = synergy.find(r => r.nameEn === key);
      nm.textContent = rec?.nameJa || key;
      frag.appendChild(nm);
    }

    for (const r of synergy) {
      const i = laneIdx.get(r.nameEn) ?? 0;
      const rowTop = synergyTop + i * SYNERGY_ROW_H;
      const x = X_OFF + r.t * PX_PER_SEC;
      const w = Math.max(24, (r.duration || 20) * PX_PER_SEC);
      const color = r.color || '#f2cf7a';

      const seg = div('synergy-segment a');
      applyStyle(seg, { left: `${x}px`, top: `${rowTop + 2}px`, width: `${w}px`, '--synergy-color': color });
      seg.title = `${r.nameJa || r.nameEn} (${r.sourceName || ''})`;
      frag.appendChild(seg);

      const start = div('synergy-start a');
      applyStyle(start, { left: `${x - 6}px`, top: `${rowTop - 2}px`, '--synergy-color': color });
      const fallback = div('synergy-start-icon synergy-start-fallback');
      fallback.textContent = (r.nameJa || r.nameEn || '?').slice(0, 1);
      start.appendChild(fallback);
      frag.appendChild(start);
    }
  }

  // --- Personal view player track ---

  function buildPersonalTrack(player, playerStart, synergyLaneDefs, synergy, frag, owner) {
    const ogcdTop = playerStart + OGCD_OFFSET;
    const gcdTop = playerStart + GCD_OFFSET;
    const synergyTop = playerStart + SYNERGY_OFFSET;
    const nLanes = synergyLaneDefs.length;
    const synergyBlockH = Math.max(22, nLanes * SYNERGY_ROW_H + 14);
    const trackH = Math.max(TRACK_MIN_H, SYNERGY_OFFSET + synergyBlockH + 14);

    // Track background
    const track = div(`track ${owner}`);
    applyStyle(track, { top: `${playerStart}px`, height: `${trackH}px` });
    frag.appendChild(track);

    // Player label (left: 8px from CSS)
    const label = div(`player-label player-label-${owner}`);
    applyStyle(label, { top: `${ogcdTop - 7}px` });
    label.textContent = player.name;
    frag.appendChild(label);

    // Lane labels
    const lblOgcd = div('lane-label');
    applyStyle(lblOgcd, { top: `${ogcdTop + 12}px` });
    lblOgcd.textContent = 'アビリティ';
    frag.appendChild(lblOgcd);

    const lblGcd = div('lane-label');
    applyStyle(lblGcd, { top: `${gcdTop + 12}px` });
    lblGcd.textContent = 'GCD';
    frag.appendChild(lblGcd);

    if (nLanes) {
      const lblSyn = div('lane-label');
      applyStyle(lblSyn, { top: `${synergyTop - 14}px` });
      lblSyn.textContent = 'シナジー';
      frag.appendChild(lblSyn);
    }

    // Lane guide lines
    const guideOgcd = div(`lane-guide-line ${owner} ability`);
    applyStyle(guideOgcd, { top: `${ogcdTop + 23}px` });
    frag.appendChild(guideOgcd);

    const guideGcd = div(`lane-guide-line ${owner} gcd`);
    applyStyle(guideGcd, { top: `${gcdTop + 23}px` });
    frag.appendChild(guideGcd);

    for (let i = 0; i < nLanes; i++) {
      const guideSyn = div(`lane-guide-line ${owner} synergy`);
      applyStyle(guideSyn, { top: `${synergyTop + i * SYNERGY_ROW_H + 7}px` });
      frag.appendChild(guideSyn);
    }

    // Synergy
    buildSynergyLanes(synergy, synergyTop, frag);

    // Events (collision-aware)
    const lastX = { gcd: -999, ogcd: -999 };
    const minGap = 24;
    for (const r of player.timeline || []) {
      const lane = isGcd(r) ? 'gcd' : 'ogcd';
      const baseX = X_OFF + r.t * PX_PER_SEC;
      const x = Math.max(baseX, lastX[lane] + minGap);
      lastX[lane] = x;
      const top = lane === 'gcd' ? gcdTop : ogcdTop;

      const ev = div(`event ${owner}`);
      applyStyle(ev, { left: `${x}px`, top: `${top}px` });
      ev.title = `${formatTime(r.t)} ${r.label || r.action}`;

      if (r.icon) {
        const img = document.createElement('img');
        img.className = 'event-icon';
        img.src = r.icon;
        img.alt = r.label || r.action;
        img.addEventListener('error', () => {
          const sp = document.createElement('span');
          sp.textContent = eventFallback(r);
          img.replaceWith(sp);
        });
        ev.appendChild(img);
      } else {
        const sp = document.createElement('span');
        sp.textContent = eventFallback(r);
        ev.appendChild(sp);
      }
      frag.appendChild(ev);
    }

    return trackH;
  }

  // --- Personal view render ---

  function renderPersonalView(data, viewWrap) {
    viewWrap.textContent = '';

    const maxSec = Math.min(data.previewMaxSec || 300, 300);
    const synA = (data.synergy || []);
    const synergyLaneDefs = [...new Set(synA.map(r => r.nameEn))];
    const nLanes = synergyLaneDefs.length;
    const synergyBlockH = Math.max(22, nLanes * SYNERGY_ROW_H + 14);
    const trackH = Math.max(TRACK_MIN_H, SYNERGY_OFFSET + synergyBlockH + 14);

    const playerAStart = RULER_TOP + PLAYER_A_START_OFFSET;
    const dividerTop = playerAStart + trackH + DIVIDER_OFFSET;
    const playerBStart = dividerTop + PLAYER_B_GAP;
    const totalH = playerBStart + trackH + 20;
    const totalW = X_OFF + maxSec * PX_PER_SEC + 80;

    const wrap = div('timeline-wrap');
    viewWrap.appendChild(wrap);

    const tl = div('timeline');
    applyStyle(tl, { width: `${totalW}px`, height: `${totalH}px` });
    wrap.appendChild(tl);

    const frag = document.createDocumentFragment();

    buildGridAndTicks(maxSec, RULER_TOP, totalH, frag);
    buildBossCastBars(data.bossCasts || [], frag);

    const trackAH = buildPersonalTrack(data.players[0], playerAStart, synergyLaneDefs, synA, frag, 'a');
    void trackAH;

    const divEl = div('player-divider');
    applyStyle(divEl, { top: `${dividerTop}px` });
    frag.appendChild(divEl);

    buildPersonalTrack(data.players[1], playerBStart, synergyLaneDefs, synA, frag, 'b');

    tl.appendChild(frag);

    buildCaption(data, viewWrap);
  }

  // --- Party view ---

  function buildPartyGridAndTicks(maxSec, rulerTop, totalH, frag) {
    const lineH = totalH - rulerTop;
    for (let t = 0; t <= maxSec; t++) {
      const x = X_OFF_PT + t * PX_PER_SEC;
      const cls = t % 10 === 0 ? 'ten' : t % 5 === 0 ? 'five' : 'one';

      const line = div(`timeline-grid-line ${cls}`);
      applyStyle(line, { left: `${x}px`, top: `${rulerTop}px`, height: `${lineH}px` });
      frag.appendChild(line);

      const tick = div(`tick ${cls}`);
      applyStyle(tick, { left: `${x}px`, top: `${rulerTop}px` });
      if (t % 5 === 0) {
        const label = document.createElement('span');
        label.textContent = formatTime(t);
        tick.appendChild(label);
      }
      frag.appendChild(tick);
    }
  }

  function buildPartyRows(rows, rowStartTop, frag, owner) {
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i];
      const rowTop = rowStartTop + i * PT_ROW_H;
      const eventTop = rowTop + Math.round((PT_ROW_H - 30) / 2);

      // Row separator
      const line = div(`pt-row-line ${owner}`);
      applyStyle(line, { top: `${rowTop}px` });
      frag.appendChild(line);

      // Player label
      const lbl = div('pt-row-label');
      applyStyle(lbl, { top: `${rowTop + Math.round((PT_ROW_H - 20) / 2)}px` });
      lbl.textContent = `${p.name}  ${p.job}`;
      frag.appendChild(lbl);

      // Events
      const lastX = { slot: new Map() };
      const minGap = 14;
      for (const r of p.timeline || []) {
        const baseX = X_OFF_PT + r.t * PX_PER_SEC;
        const slot = Math.floor(r.t * 2);
        const prevX = lastX.slot.get(slot) ?? -999;
        const x = Math.max(baseX, prevX + minGap);
        lastX.slot.set(slot, x);

        const ev = div('pt-event');
        applyStyle(ev, { left: `${x}px`, top: `${eventTop}px` });
        ev.title = `${formatTime(r.t)} ${r.label || r.action}`;

        if (r.icon) {
          const img = document.createElement('img');
          img.className = 'event-icon';
          img.src = r.icon;
          img.alt = r.label || r.action;
          img.addEventListener('error', () => {
            const sp = document.createElement('span');
            sp.textContent = eventFallback(r);
            img.replaceWith(sp);
          });
          ev.appendChild(img);
        } else {
          const sp = document.createElement('span');
          sp.textContent = eventFallback(r);
          ev.appendChild(sp);
        }
        frag.appendChild(ev);
      }
    }
  }

  function renderPartyView(data, viewWrap) {
    viewWrap.textContent = '';

    const maxSec = Math.min(data.previewMaxSec || 300, 300);
    const partyA = data.partyA || [];
    const partyB = data.partyB || [];

    const rulerTop = BOSS_LANE_LINE_TOP + 10;
    const groupALabelTop = rulerTop + 16;
    const rowAStart = groupALabelTop + PT_GROUP_LABEL_H;
    const rowAEnd = rowAStart + partyA.length * PT_ROW_H;
    const dividerTop = rowAEnd + 8;
    const groupBLabelTop = dividerTop + 30;
    const rowBStart = groupBLabelTop + PT_GROUP_LABEL_H;
    const rowBEnd = rowBStart + partyB.length * PT_ROW_H;
    const totalH = rowBEnd + 20;
    const totalW = X_OFF_PT + maxSec * PX_PER_SEC + 80;

    const wrap = div('timeline-wrap');
    viewWrap.appendChild(wrap);

    const tl = div('timeline');
    applyStyle(tl, { width: `${totalW}px`, height: `${totalH}px` });
    wrap.appendChild(tl);

    const frag = document.createDocumentFragment();

    buildPartyGridAndTicks(maxSec, rulerTop, totalH, frag);

    // Boss casts at top
    buildBossCastBars(data.bossCasts || [], frag);

    // Group A
    const glA = div('pt-group-label a');
    applyStyle(glA, { top: `${groupALabelTop}px` });
    glA.textContent = 'A側';
    frag.appendChild(glA);

    buildPartyRows(partyA, rowAStart, frag, 'a');

    const divEl = div('player-divider');
    applyStyle(divEl, { top: `${dividerTop}px` });
    frag.appendChild(divEl);

    // Group B
    const glB = div('pt-group-label b');
    applyStyle(glB, { top: `${groupBLabelTop}px` });
    glB.textContent = 'B側';
    frag.appendChild(glB);

    buildPartyRows(partyB, rowBStart, frag, 'b');

    tl.appendChild(frag);

    buildCaption(data, viewWrap);
  }

  // --- Player comparison header ---

  function buildPlayerHeader(players, container) {
    const wrapper = div('premium-preview-players');

    const mkSide = (p, side) => {
      const d = div(`premium-preview-player-${side}`);
      const name = document.createElement('span');
      name.className = 'premium-preview-pname';
      name.textContent = p.name;
      const job = document.createElement('span');
      job.className = 'premium-preview-pjob';
      job.textContent = p.job;
      const dps = document.createElement('span');
      dps.className = 'premium-preview-pdps';
      dps.textContent = formatDps(p.dps) + ' DPS';
      d.appendChild(name);
      d.appendChild(job);
      d.appendChild(dps);
      return d;
    };

    wrapper.appendChild(mkSide(players[0], 'a'));
    const vs = div('premium-preview-vs');
    vs.textContent = 'vs';
    wrapper.appendChild(vs);
    wrapper.appendChild(mkSide(players[1], 'b'));
    container.appendChild(wrapper);
  }

  function buildCaption(data, container) {
    const p = document.createElement('p');
    p.className = 'premium-preview-caption';
    const linkText = document.createTextNode('出典: ');
    p.appendChild(linkText);
    const a = document.createElement('a');
    a.href = `https://ja.fflogs.com/reports/${data.reportCode}?fight=${data.fightId}&type=damage-done`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `FFLogs ${data.encounter}`;
    p.appendChild(a);
    p.appendChild(document.createTextNode(' — 最初の5分間を表示（横スクロール可）'));
    container.appendChild(p);
  }

  // --- Main render with tabs ---

  function render(data, container) {
    container.textContent = '';

    buildPlayerHeader(data.players, container);

    const hasParty = (data.partyA?.length > 0) || (data.partyB?.length > 0);

    const tabs = div('premium-preview-tabs');
    const btnPersonal = div('premium-preview-tab is-active');
    btnPersonal.textContent = '個人比較';
    const btnParty = div('premium-preview-tab');
    btnParty.textContent = 'PT分析';
    tabs.appendChild(btnPersonal);
    if (hasParty) tabs.appendChild(btnParty);
    container.appendChild(tabs);

    const viewWrap = div('premium-preview-view');
    container.appendChild(viewWrap);

    function showPersonal() {
      btnPersonal.classList.add('is-active');
      btnParty.classList.remove('is-active');
      renderPersonalView(data, viewWrap);
    }

    function showParty() {
      btnParty.classList.add('is-active');
      btnPersonal.classList.remove('is-active');
      renderPartyView(data, viewWrap);
    }

    btnPersonal.addEventListener('click', showPersonal);
    btnParty.addEventListener('click', showParty);

    showPersonal();
  }

  function init() {
    const outer = document.getElementById('premiumPreviewOuter');
    if (!outer) return;
    outer.textContent = '比較データを読み込み中...';

    fetch(DATA_URL)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => render(data, outer))
      .catch(() => {
        outer.textContent = 'プレビューデータを読み込めませんでした。';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
