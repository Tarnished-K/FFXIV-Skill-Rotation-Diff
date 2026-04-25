// Premium page: loads static preview JSON and renders a read-only comparison timeline.
// Data source: assets/premium-preview-data.json (committed static snapshot, not user input).
(function PremiumPreview() {
  'use strict';

  const DATA_URL = './assets/premium-preview-data.json';
  const PX_PER_SEC = 60;

  // Layout constants — personal view
  const RULER_TOP = 8;
  const RULER_H = 24;
  const BOSS_LANE_TOP = RULER_TOP + RULER_H + 4;
  const BOSS_LANE_H = 30;
  const BOSS_BAR_H = 22;
  const SYNERGY_ROW_H = 14;
  const PLAYER_LABEL_H = 32;
  const OGCD_H = 22;
  const GCD_H = 28;
  const PLAYER_BLOCK_H = PLAYER_LABEL_H + 56 + OGCD_H + 16;
  const DIVIDER_H = 20;

  // Layout constants — party view
  const PARTY_ROW_H = 40;
  const PARTY_EVENT_H = 22;
  const GROUP_LABEL_H = 24;

  // --- DOM helpers ---

  function div(className, style) {
    const d = document.createElement('div');
    if (className) d.className = className;
    if (style) Object.assign(d.style, style);
    return d;
  }

  function span(className, text) {
    const s = document.createElement('span');
    if (className) s.className = className;
    if (text !== undefined) s.textContent = text;
    return s;
  }

  function text(str) {
    return document.createTextNode(str);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatDps(dps) {
    if (dps >= 1000) return `${(dps / 1000).toFixed(1)}k`;
    return String(dps);
  }

  // --- Ruler ---

  function buildRuler(maxSec, pxPerSec) {
    const ruler = div('ruler');
    Object.assign(ruler.style, { top: `${RULER_TOP}px`, position: 'absolute', left: '0', right: '0', height: `${RULER_H}px` });
    for (let t = 0; t <= maxSec; t += 1) {
      const x = t * pxPerSec;
      const cls = t % 10 === 0 ? 'ten' : t % 5 === 0 ? 'five' : 'one';
      const tick = div(`tick ${cls}`);
      tick.style.left = `${x}px`;
      if (t % 30 === 0) {
        const label = span('', formatTime(t));
        tick.appendChild(label);
      }
      ruler.appendChild(tick);
    }
    return ruler;
  }

  // --- Grid lines ---

  function buildGridLines(maxSec, pxPerSec, totalH) {
    const frag = document.createDocumentFragment();
    for (let t = 0; t <= maxSec; t += 1) {
      const x = t * pxPerSec;
      const cls = t % 10 === 0 ? 'ten' : t % 5 === 0 ? 'five' : '';
      const line = div(`timeline-grid-line ${cls}`);
      Object.assign(line.style, { left: `${x}px`, height: `${totalH}px` });
      frag.appendChild(line);
    }
    return frag;
  }

  // --- Boss cast lane ---

  function buildBossLane(bossCasts, pxPerSec) {
    const frag = document.createDocumentFragment();
    const barTopY = BOSS_LANE_TOP + Math.round((BOSS_LANE_H - BOSS_BAR_H) / 2);

    for (const r of bossCasts) {
      const x = Math.round(r.t * pxPerSec);
      const w = Math.max(4, Math.round(((r.endT || r.t + 3) - r.t) * pxPerSec));
      const label = r.actionJa || r.action || '';
      const titleText = (r.sourceName ? r.sourceName + ': ' : '') + label;
      const cls = r.isBoss ? 'boss-cast-bar a' : 'boss-cast-bar add a';
      const bar = div(cls);
      Object.assign(bar.style, { left: `${x}px`, top: `${barTopY}px`, width: `${w}px` });
      bar.title = titleText;
      bar.appendChild(span('', label));
      frag.appendChild(bar);
    }

    const laneLine = div('boss-cast-lane-line');
    laneLine.style.top = `${BOSS_LANE_TOP + BOSS_LANE_H - 2}px`;
    frag.appendChild(laneLine);
    return frag;
  }

  // --- Synergy lane ---

  function buildSynergyLane(synergy, synergyLaneTop, pxPerSec, labelContainer) {
    const laneKeys = [...new Set(synergy.map(r => r.nameEn))];
    const laneIndexByKey = new Map(laneKeys.map((k, i) => [k, i]));
    const colorByKey = new Map(synergy.map(r => [r.nameEn, r.color || '#888']));

    for (const [key, idx] of laneIndexByKey) {
      const nameEl = div('synergy-lane-name');
      nameEl.style.top = `${synergyLaneTop + idx * SYNERGY_ROW_H}px`;
      nameEl.style.color = colorByKey.get(key) || '#888';
      const rec = synergy.find(r => r.nameEn === key);
      nameEl.textContent = rec?.nameJa || key;
      labelContainer.appendChild(nameEl);
    }

    const frag = document.createDocumentFragment();
    for (const r of synergy) {
      const idx = laneIndexByKey.get(r.nameEn) ?? 0;
      const top = synergyLaneTop + idx * SYNERGY_ROW_H + 3;
      const x = Math.round(r.t * pxPerSec);
      const w = Math.round((r.duration || 20) * pxPerSec);
      const seg = div('synergy-segment a');
      Object.assign(seg.style, { left: `${x}px`, top: `${top}px`, width: `${w}px`, '--synergy-color': r.color || '#888' });
      seg.title = `${r.nameJa || r.nameEn} (${r.sourceName || ''})`;
      frag.appendChild(seg);
    }
    return frag;
  }

  // --- Player track (personal view) ---

  function buildPlayerTrack(player, trackTop, pxPerSec, owner) {
    const frag = document.createDocumentFragment();

    const label = div(`player-label player-label-${owner}`);
    label.style.top = `${trackTop}px`;
    const nameSpan = span('', player.name);
    const jobSmall = document.createElement('small');
    jobSmall.className = 'player-preview-job';
    jobSmall.textContent = player.job;
    const dpsSpan = span('player-preview-dps', formatDps(player.dps) + ' DPS');
    label.appendChild(nameSpan);
    label.appendChild(text(' '));
    label.appendChild(jobSmall);
    label.appendChild(dpsSpan);
    frag.appendChild(label);

    const ogcdTop = trackTop + PLAYER_LABEL_H;
    const gcdTop = trackTop + PLAYER_LABEL_H + OGCD_H + 10;

    for (const r of player.timeline || []) {
      const isGcd = r.castEndT != null && (r.castEndT - r.t) > 1.0;
      const top = isGcd ? gcdTop : ogcdTop;
      const h = isGcd ? GCD_H : OGCD_H;
      const x = Math.round(r.t * pxPerSec);
      const w = isGcd ? Math.max(6, Math.round((r.castEndT - r.t) * pxPerSec)) : 8;
      const eventEl = div('event');
      Object.assign(eventEl.style, { left: `${x}px`, top: `${top}px`, height: `${h}px`, width: `${w}px` });
      eventEl.title = r.action || '';
      frag.appendChild(eventEl);
    }

    return frag;
  }

  // --- Compact party row (party view) ---

  function buildPartyRow(player, rowTop, pxPerSec, owner) {
    const frag = document.createDocumentFragment();

    const label = div(`player-label player-label-${owner} party-preview-row-label`);
    label.style.top = `${rowTop}px`;
    label.style.height = `${PARTY_ROW_H}px`;
    const nameSpan = span('', player.name);
    const jobSmall = document.createElement('small');
    jobSmall.className = 'player-preview-job';
    jobSmall.textContent = player.job;
    label.appendChild(nameSpan);
    label.appendChild(text(' '));
    label.appendChild(jobSmall);
    frag.appendChild(label);

    const eventTop = rowTop + Math.round((PARTY_ROW_H - PARTY_EVENT_H) / 2);
    for (const r of player.timeline || []) {
      const isGcd = r.castEndT != null && (r.castEndT - r.t) > 1.0;
      const x = Math.round(r.t * pxPerSec);
      const w = isGcd ? Math.max(6, Math.round((r.castEndT - r.t) * pxPerSec)) : 8;
      const eventEl = div('event');
      Object.assign(eventEl.style, { left: `${x}px`, top: `${eventTop}px`, height: `${PARTY_EVENT_H}px`, width: `${w}px` });
      eventEl.title = r.action || '';
      frag.appendChild(eventEl);
    }

    return frag;
  }

  // --- Top player comparison header ---

  function buildPlayerHeader(players, container) {
    const wrapper = div('premium-preview-players');

    const mkSide = (p, side) => {
      const d = div(`premium-preview-player-${side}`);
      const name = span('premium-preview-pname', p.name);
      const job = span('premium-preview-pjob', p.job);
      const dps = span('premium-preview-pdps', formatDps(p.dps) + ' DPS');
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

  // --- Caption ---

  function buildCaption(data, container) {
    const p = document.createElement('p');
    p.className = 'premium-preview-caption';
    p.appendChild(text('出典: '));
    const a = document.createElement('a');
    a.href = `https://ja.fflogs.com/reports/${data.reportCode}?fight=${data.fightId}&type=damage-done`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = `FFLogs ${data.encounter}`;
    p.appendChild(a);
    p.appendChild(text(' — 最初の5分間を表示（横スクロール可）'));
    container.appendChild(p);
  }

  // --- Shared timeline scaffold ---

  function buildTimelineScaffold(data, totalH) {
    const maxSec = Math.min(data.previewMaxSec || 300, 300);
    const totalW = maxSec * PX_PER_SEC;

    const scrollWrap = div('premium-preview-scroll');
    const timeline = div('timeline');
    Object.assign(timeline.style, { width: `${totalW}px`, height: `${totalH}px`, position: 'relative' });
    scrollWrap.appendChild(timeline);

    timeline.appendChild(buildGridLines(maxSec, PX_PER_SEC, totalH));
    timeline.appendChild(buildRuler(maxSec, PX_PER_SEC));
    timeline.appendChild(buildBossLane(data.bossCasts || [], PX_PER_SEC));

    return { scrollWrap, timeline, maxSec };
  }

  function synergyLayout(data) {
    const uniqueSynergyKeys = [...new Set((data.synergy || []).map(r => r.nameEn))];
    const synergyH = Math.max(SYNERGY_ROW_H, uniqueSynergyKeys.length * SYNERGY_ROW_H + 6);
    const synergyLaneTop = BOSS_LANE_TOP + BOSS_LANE_H + 6;
    return { synergyH, synergyLaneTop };
  }

  // --- Personal view ---

  function renderPersonalView(data, viewWrap) {
    viewWrap.textContent = '';

    const { synergyH, synergyLaneTop } = synergyLayout(data);
    const playerATop = synergyLaneTop + synergyH + 8;
    const playerABottom = playerATop + PLAYER_BLOCK_H;
    const dividerTop = playerABottom + 4;
    const playerBTop = dividerTop + DIVIDER_H;
    const playerBBottom = playerBTop + PLAYER_BLOCK_H;
    const totalH = playerBBottom + 12;

    const { scrollWrap, timeline } = buildTimelineScaffold(data, totalH);
    viewWrap.appendChild(scrollWrap);

    timeline.appendChild(buildSynergyLane(data.synergy || [], synergyLaneTop, PX_PER_SEC, timeline));
    timeline.appendChild(buildPlayerTrack(data.players[0], playerATop, PX_PER_SEC, 'a'));

    const dividerEl = div('player-divider');
    dividerEl.style.top = `${dividerTop}px`;
    timeline.appendChild(dividerEl);

    timeline.appendChild(buildPlayerTrack(data.players[1], playerBTop, PX_PER_SEC, 'b'));

    buildCaption(data, viewWrap);
  }

  // --- Party view ---

  function renderPartyView(data, viewWrap) {
    viewWrap.textContent = '';

    const partyA = data.partyA || [];
    const partyB = data.partyB || [];

    const { synergyH, synergyLaneTop } = synergyLayout(data);
    const groupALabelTop = synergyLaneTop + synergyH + 8;
    const groupAStart = groupALabelTop + GROUP_LABEL_H;
    const groupAEnd = groupAStart + partyA.length * PARTY_ROW_H;
    const dividerTop = groupAEnd + 4;
    const groupBLabelTop = dividerTop + DIVIDER_H;
    const groupBStart = groupBLabelTop + GROUP_LABEL_H;
    const groupBEnd = groupBStart + partyB.length * PARTY_ROW_H;
    const totalH = groupBEnd + 12;

    const { scrollWrap, timeline } = buildTimelineScaffold(data, totalH);
    viewWrap.appendChild(scrollWrap);

    timeline.appendChild(buildSynergyLane(data.synergy || [], synergyLaneTop, PX_PER_SEC, timeline));

    const glabelA = div('party-preview-group-label');
    glabelA.style.top = `${groupALabelTop}px`;
    glabelA.textContent = 'A側';
    timeline.appendChild(glabelA);

    for (let i = 0; i < partyA.length; i++) {
      timeline.appendChild(buildPartyRow(partyA[i], groupAStart + i * PARTY_ROW_H, PX_PER_SEC, 'a'));
    }

    const dividerEl = div('player-divider');
    dividerEl.style.top = `${dividerTop}px`;
    timeline.appendChild(dividerEl);

    const glabelB = div('party-preview-group-label');
    glabelB.style.top = `${groupBLabelTop}px`;
    glabelB.textContent = 'B側';
    timeline.appendChild(glabelB);

    for (let i = 0; i < partyB.length; i++) {
      timeline.appendChild(buildPartyRow(partyB[i], groupBStart + i * PARTY_ROW_H, PX_PER_SEC, 'b'));
    }

    buildCaption(data, viewWrap);
  }

  // --- Main render (with tabs) ---

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
