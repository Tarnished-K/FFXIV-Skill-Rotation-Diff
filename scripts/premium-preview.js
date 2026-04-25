// Premium page: injects captured timeline HTML snapshots with interactive controls.
// Snapshots: assets/premium-preview-timeline.html (personal), assets/premium-preview-party.html (party)
// Run __captureTimelineHTML('personal') or __captureTimelineHTML('party') to update.
(function PremiumPreview() {
  'use strict';

  const SNAPSHOT_URLS = {
    personal: './assets/premium-preview-timeline.html',
    party:    './assets/premium-preview-party.html',
  };
  // Scroll-to time (seconds) for 奇数分/偶数分 TL tabs
  const TAB_SCROLL_SEC = { all: 0, odd: 60, even: 120 };

  const ZOOM_STEPS = [50, 75, 100, 125, 150, 200];
  let zoomIdx  = 2;    // 100%
  let currentView = 'personal';
  let currentTab  = 'all';
  const snapshotCache = {};

  // ---- Drag scroll ----

  function bindDragScroll(wrap) {
    let dragging = false, startX = 0, scrollLeft = 0;
    wrap.addEventListener('mousedown', e => {
      dragging = true; startX = e.pageX; scrollLeft = wrap.scrollLeft;
      wrap.style.cursor = 'grabbing';
    });
    document.addEventListener('mouseup', () => { dragging = false; wrap.style.cursor = ''; });
    wrap.addEventListener('mousemove', e => {
      if (!dragging) return;
      e.preventDefault();
      wrap.scrollLeft = scrollLeft - (e.pageX - startX);
    });
  }

  function bindWheelScroll(wrap) {
    wrap.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      wrap.scrollLeft += e.deltaY * 3;
    }, { passive: false });
  }

  // ---- Horizontal-only zoom ----
  // Scales only inline left/width (pxPerSec equivalent). Icon sizes (from CSS) are unchanged.

  function cacheZoomOrigins(timeline) {
    if (timeline.dataset.zoomCached) return;
    timeline.dataset.origTWidth = parseFloat(timeline.style.width) || 0;
    timeline.querySelectorAll('[style]').forEach(el => {
      if (el.style.left)  el.dataset.origLeft  = parseFloat(el.style.left)  || 0;
      if (el.style.width) el.dataset.origWidth = parseFloat(el.style.width) || 0;
    });
    timeline.dataset.zoomCached = '1';
  }

  function applyZoom(wrap) {
    const timeline = wrap?.querySelector('.timeline');
    if (!timeline) return;
    cacheZoomOrigins(timeline);
    const f = ZOOM_STEPS[zoomIdx] / 100;
    timeline.style.width = `${parseFloat(timeline.dataset.origTWidth) * f}px`;
    timeline.querySelectorAll('[data-orig-left], [data-orig-width]').forEach(el => {
      if (el.dataset.origLeft  !== undefined) el.style.left  = `${parseFloat(el.dataset.origLeft)  * f}px`;
      if (el.dataset.origWidth !== undefined) el.style.width = `${parseFloat(el.dataset.origWidth) * f}px`;
    });
  }

  // ---- Time-based scroll ----

  function scrollToSec(wrap, targetSec) {
    if (targetSec === 0) { wrap.scrollLeft = 0; return; }
    // Detect pxPerSec from tick marks (already scaled by zoom)
    let t0 = null, t60 = null;
    wrap.querySelectorAll('.tick').forEach(tick => {
      const text = tick.querySelector('span')?.textContent.trim();
      const left = parseFloat(tick.style.left || '0');
      if (text === '0:00') t0 = left;
      if (text === '1:00') t60 = left;
    });
    let scrollTarget;
    if (t0 !== null && t60 !== null) {
      const pxPerSec = (t60 - t0) / 60;
      scrollTarget = Math.max(0, t0 + targetSec * pxPerSec - 200);
    } else {
      // Fallback
      scrollTarget = Math.max(0, (60 + targetSec * 40) * (ZOOM_STEPS[zoomIdx] / 100) - 200);
    }
    wrap.scrollLeft = scrollTarget;
  }

  function applyTabScroll(outer) {
    const wrap = outer.querySelector('.timeline-wrap');
    if (!wrap) return;
    scrollToSec(wrap, TAB_SCROLL_SEC[currentTab] ?? 0);
  }

  // ---- Name anonymization ----

  function anonymizeNames(slot) {
    // DPS graph: hide player-name labels, keep axis numbers (text-anchor="end")
    slot.querySelectorAll('.dps-graph-svg text:not([text-anchor="end"])').forEach(t => {
      t.style.visibility = 'hidden';
    });

    // PT row labels: "ジョブ プレイヤー名" → "ジョブ"
    const groupLabelB = slot.querySelector('.pt-group-label.b');
    const bTop = groupLabelB ? parseFloat(groupLabelB.style.top || '9999') : 9999;
    let countA = 0, countB = 0;

    slot.querySelectorAll('.pt-row-label').forEach(el => {
      const top  = parseFloat(el.style.top || '0');
      const job  = el.textContent.trim().split(' ')[0] || '';
      const grp  = top > bTop ? 'B' : 'A';
      const num  = grp === 'B' ? ++countB : ++countA;
      el.dataset.ppTop = top;
      el.dataset.ppJob = job;
      el.dataset.ppGrp = grp;
      el.dataset.ppNum = num;
      el.textContent = job;
      el.removeAttribute('title');
    });
  }

  // ---- Phase buttons ----

  function buildPhaseButtons(outer, slot) {
    outer.querySelector('.pp-phase-bar')?.remove();

    const phases = [{ label: 'P1', left: 0 }];
    slot.querySelectorAll('.phase-divider.a').forEach(el => {
      const left  = parseFloat(el.style.left) || 0;
      const label = el.querySelector('.phase-divider-label')?.textContent.trim() || '';
      if (label && left > 0) phases.push({ label, left });
    });
    if (phases.length <= 1) return;

    const bar = document.createElement('div');
    bar.className = 'pp-phase-bar phase-btns';
    phases.forEach(({ label, left }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phase-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const wrap = outer.querySelector('.timeline-wrap');
        if (!wrap) return;
        // left is the original value; after zoom cacheZoomOrigins scales it via style.left
        // Read the current (scaled) style.left from the phase-divider element itself
        const divider = slot.querySelector('.phase-divider.a');
        // Re-locate this specific divider by matching closest label
        let scaledLeft = left * (ZOOM_STEPS[zoomIdx] / 100);
        const div = Array.from(slot.querySelectorAll('.phase-divider.a')).find(d =>
          parseFloat(d.dataset.origLeft || d.style.left) * (ZOOM_STEPS[zoomIdx] / 100) === scaledLeft ||
          Math.abs((parseFloat(d.dataset.origLeft || parseFloat(d.style.left) / (ZOOM_STEPS[zoomIdx] / 100))) - left) < 1
        );
        if (div) scaledLeft = parseFloat(div.style.left) || scaledLeft;
        wrap.scrollLeft = Math.max(0, scaledLeft - 200);
      });
      bar.appendChild(btn);
    });

    outer.insertBefore(bar, outer.querySelector('.pp-wrap-slot'));
  }

  // ---- Player filter (PT view) ----

  function buildPlayerFilter(outer, slot) {
    outer.querySelector('.pp-player-filter')?.remove();

    const rows = Array.from(slot.querySelectorAll('.pt-row-label[data-pp-top]'));
    if (rows.length === 0) return;

    const timeline = slot.querySelector('.timeline');
    const ROW_H = 40;

    const bar = document.createElement('div');
    bar.className = 'pp-player-filter phase-btns';

    rows.forEach(rowLabel => {
      const rowTop = parseFloat(rowLabel.dataset.ppTop);
      const job    = rowLabel.dataset.ppJob || '?';
      const grp    = rowLabel.dataset.ppGrp || 'A';
      const num    = rowLabel.dataset.ppNum || '?';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phase-btn active';
      btn.textContent = `${job} (${grp}${num})`;

      let visible = true;
      btn.addEventListener('click', () => {
        visible = !visible;
        btn.classList.toggle('active', visible);
        rowLabel.style.opacity = visible ? '' : '0.25';
        if (!timeline) return;

        // Events are at top ≈ rowTop - 3 (row starts ~8px before label)
        const evMin = rowTop - 8;
        const evMax = rowTop + (ROW_H - 8); // rowTop + 32
        timeline.querySelectorAll('.pt-event').forEach(ev => {
          const t = parseFloat(ev.style.top || '0');
          if (t >= evMin && t < evMax) ev.style.display = visible ? '' : 'none';
        });

        // Row guide line: top ≈ rowTop + 10
        timeline.querySelectorAll('.pt-row-line').forEach(line => {
          const t = parseFloat(line.style.top || '0');
          if (Math.abs(t - (rowTop + 10)) < 6) line.style.opacity = visible ? '' : '0.1';
        });
      });

      bar.appendChild(btn);
    });

    outer.insertBefore(bar, outer.querySelector('.pp-wrap-slot'));
  }

  // ---- Snapshot injection ----

  function injectSnapshot(outer, html) {
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const src  = doc.querySelector('.timeline-wrap');
    const slot = outer.querySelector('.pp-wrap-slot');

    if (!src) {
      slot.innerHTML = '<p class="premium-preview-loading">スナップショット未収集（準備中）</p>';
      outer.querySelector('.pp-phase-bar')?.remove();
      outer.querySelector('.pp-player-filter')?.remove();
      return;
    }

    slot.innerHTML = '';
    slot.appendChild(document.adoptNode(src));

    anonymizeNames(slot);
    buildPhaseButtons(outer, slot);
    if (currentView === 'party') buildPlayerFilter(outer, slot);
    else outer.querySelector('.pp-player-filter')?.remove();

    const wrap = slot.querySelector('.timeline-wrap');
    bindDragScroll(wrap);
    bindWheelScroll(wrap);
    applyZoom(wrap);
    applyTabScroll(outer);
  }

  // ---- Controls bar ----

  function buildControls(outer) {
    const bar = document.createElement('div');
    bar.className = 'pp-controls-bar';

    // Personal / Party
    const viewTabs = document.createElement('div');
    viewTabs.className = 'timeline-view-tabs';
    viewTabs.innerHTML = `
      <button class="timeline-view-btn active" data-view="personal">個人比較</button>
      <button class="timeline-view-btn" data-view="party">PT比較</button>`;

    // 全体 / 奇数分 / 偶数分
    const tlTabs = document.createElement('div');
    tlTabs.className = 'tabs';
    tlTabs.innerHTML = `
      <button class="tab active" data-tltab="all">全体TL</button>
      <button class="tab" data-tltab="odd">奇数分TL</button>
      <button class="tab" data-tltab="even">偶数分TL</button>`;

    // Zoom
    const zoom = document.createElement('div');
    zoom.className = 'zoom-controls';
    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'pp-zoom-label';
    zoomLabel.style.cssText = 'min-width:44px;color:var(--text-secondary);font-size:13px;text-align:center';
    zoomLabel.textContent = `${ZOOM_STEPS[zoomIdx]}%`;
    const zoomOut = document.createElement('button');
    zoomOut.type = 'button'; zoomOut.dataset.delta = '-1'; zoomOut.textContent = '−';
    const zoomIn  = document.createElement('button');
    zoomIn.type  = 'button'; zoomIn.dataset.delta  =  '1'; zoomIn.textContent  = '＋';
    zoom.append(zoomOut, zoomLabel, zoomIn);

    // Layer toggles
    const layerCtrl = document.createElement('div');
    layerCtrl.className = 'timeline-layer-controls';
    layerCtrl.innerHTML = [
      { key: 'synergy', label: 'シナジー' },
      { key: 'debuff',  label: 'デバフ' },
      { key: 'cast',    label: 'ボスキャスト' },
    ].map(({ key, label }) =>
      `<label class="timeline-layer-toggle"><input type="checkbox" data-layer="${key}" checked><span>${label}</span></label>`
    ).join('');

    bar.append(viewTabs, tlTabs, zoom, layerCtrl);
    outer.insertBefore(bar, outer.querySelector('.pp-wrap-slot'));

    // Personal / Party tab
    viewTabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn || btn.dataset.view === currentView) return;
      currentView = btn.dataset.view;
      viewTabs.querySelectorAll('.timeline-view-btn').forEach(b => b.classList.toggle('active', b === btn));
      loadView(outer);
    });

    // 全体/奇数/偶数 tab — same snapshot, just scroll
    tlTabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-tltab]');
      if (!btn || btn.dataset.tltab === currentTab) return;
      currentTab = btn.dataset.tltab;
      tlTabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      applyTabScroll(outer);
    });

    // Zoom
    zoom.addEventListener('click', e => {
      const btn = e.target.closest('[data-delta]');
      if (!btn) return;
      zoomIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomIdx + parseInt(btn.dataset.delta, 10)));
      zoomLabel.textContent = `${ZOOM_STEPS[zoomIdx]}%`;
      applyZoom(outer.querySelector('.timeline-wrap'));
    });

    // Layer toggles
    layerCtrl.addEventListener('change', e => {
      const cb = e.target.closest('[data-layer]');
      if (!cb) return;
      const wrap = outer.querySelector('.timeline-wrap');
      wrap?.classList.toggle(`pp-layer-${cb.dataset.layer}-hidden`, !cb.checked);
    });
  }

  // ---- Load snapshot ----

  function loadView(outer) {
    const url  = SNAPSHOT_URLS[currentView];
    const slot = outer.querySelector('.pp-wrap-slot');
    if (snapshotCache[url]) { injectSnapshot(outer, snapshotCache[url]); return; }
    slot.innerHTML = '<p class="premium-preview-loading">読み込み中...</p>';
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(html => { snapshotCache[url] = html; injectSnapshot(outer, html); })
      .catch(() => {
        slot.innerHTML = '<p class="premium-preview-loading">スナップショット未収集（準備中）</p>';
        outer.querySelector('.pp-phase-bar')?.remove();
        outer.querySelector('.pp-player-filter')?.remove();
      });
  }

  // ---- Init ----

  function init() {
    const outer = document.getElementById('premiumPreviewOuter');
    if (!outer) return;
    const slot = document.createElement('div');
    slot.className = 'pp-wrap-slot';
    outer.appendChild(slot);
    buildControls(outer);
    loadView(outer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
