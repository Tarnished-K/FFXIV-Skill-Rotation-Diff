// Premium page: injects captured timeline HTML snapshots with interactive controls.
// Snapshots in assets/:
//   premium-preview-timeline.html  → personal / 全体TL
//   premium-preview-personal-odd.html  → personal / 奇数分TL
//   premium-preview-personal-even.html → personal / 偶数分TL
//   premium-preview-party.html     → party / 全体TL
//   premium-preview-party-odd.html → party / 奇数分TL
//   premium-preview-party-even.html → party / 偶数分TL
// Run __captureTimelineHTML(type) in the live app to capture each view.
(function PremiumPreview() {
  'use strict';

  const SNAPSHOT_MAP = {
    personal: {
      all:  './assets/premium-preview-timeline.html',
      odd:  './assets/premium-preview-personal-odd.html',
      even: './assets/premium-preview-personal-even.html',
    },
    party: {
      all:  './assets/premium-preview-party.html',
      odd:  './assets/premium-preview-party-odd.html',
      even: './assets/premium-preview-party-even.html',
    },
  };
  const ZOOM_STEPS = [50, 75, 100, 125, 150, 200];
  let zoomIdx = 2;
  let currentView = 'personal';
  let currentTab  = 'all';
  const snapshotCache = {};

  function currentUrl() {
    return SNAPSHOT_MAP[currentView][currentTab];
  }

  // --- Scroll bindings ---

  function bindDragScroll(wrap) {
    let dragging = false, startX = 0, scrollLeft = 0;
    wrap.addEventListener('mousedown', e => {
      dragging = true;
      startX = e.pageX;
      scrollLeft = wrap.scrollLeft;
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

  // --- Name anonymization ---

  function anonymizeNames(slot) {
    // DPS graph: hide player-name labels, keep axis numbers (text-anchor="end")
    slot.querySelectorAll('.dps-graph-svg text:not([text-anchor="end"])').forEach(t => {
      t.style.visibility = 'hidden';
    });

    // PT row labels: "ジョブ プレイヤー名" → "ジョブ"
    // Determine group A vs B by comparing top with the B group-label top
    const groupLabelB = slot.querySelector('.pt-group-label.b');
    const bTop = groupLabelB ? parseFloat(groupLabelB.style.top || '9999') : 9999;

    let countA = 0, countB = 0;
    slot.querySelectorAll('.pt-row-label').forEach(el => {
      const top = parseFloat(el.style.top || '0');
      const job = (el.textContent.trim().split(' ')[0]) || '';
      const group = top > bTop ? 'B' : 'A';
      const num = group === 'B' ? ++countB : ++countA;
      el.dataset.ppGroup = group;
      el.dataset.ppNum = num;
      el.dataset.ppJob = job;
      el.dataset.ppTop = top;
      el.textContent = job;
      el.removeAttribute('title');
    });
  }

  // --- Phase buttons ---

  function buildPhaseButtons(outer, slot) {
    const old = outer.querySelector('.pp-phase-bar');
    if (old) old.remove();

    const phases = [{ label: 'P1', left: 0 }];
    slot.querySelectorAll('.phase-divider.a').forEach(el => {
      const left = parseFloat(el.style.left) || 0;
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
        const zoom = ZOOM_STEPS[zoomIdx] / 100;
        wrap.scrollLeft = Math.max(0, (left - 200) * zoom);
      });
      bar.appendChild(btn);
    });

    const wrapSlot = outer.querySelector('.pp-wrap-slot');
    outer.insertBefore(bar, wrapSlot);
  }

  // --- Player filter (PT view) ---

  function buildPlayerFilter(outer, slot) {
    const old = outer.querySelector('.pp-player-filter');
    if (old) old.remove();

    const rows = Array.from(slot.querySelectorAll('.pt-row-label[data-pp-top]'));
    if (rows.length === 0) return;

    const ROW_H = 40;
    const timeline = slot.querySelector('.timeline');

    const bar = document.createElement('div');
    bar.className = 'pp-player-filter pp-phase-bar phase-btns';

    rows.forEach(rowLabel => {
      const rowTop = parseFloat(rowLabel.dataset.ppTop);
      const job    = rowLabel.dataset.ppJob || '?';
      const group  = rowLabel.dataset.ppGroup || 'A';
      const num    = rowLabel.dataset.ppNum || '?';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phase-btn active';
      btn.textContent = `${job} (${group}${num})`;

      let visible = true;
      btn.addEventListener('click', () => {
        visible = !visible;
        btn.classList.toggle('active', visible);
        rowLabel.style.opacity = visible ? '' : '0.25';

        if (!timeline) return;
        timeline.querySelectorAll('.pt-event').forEach(ev => {
          const evTop = parseFloat(ev.style.top || '0');
          if (evTop >= rowTop && evTop < rowTop + ROW_H) {
            ev.style.display = visible ? '' : 'none';
          }
        });

        // Also hide the row guide line
        timeline.querySelectorAll('.pt-row-line').forEach(line => {
          const lTop = parseFloat(line.style.top || '0');
          if (Math.abs(lTop - (rowTop + 10)) < 5) {
            line.style.opacity = visible ? '' : '0.1';
          }
        });
      });

      bar.appendChild(btn);
    });

    const wrapSlot = outer.querySelector('.pp-wrap-slot');
    outer.insertBefore(bar, wrapSlot);
  }

  // --- Snapshot injection ---

  function injectSnapshot(outer, html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const src = doc.querySelector('.timeline-wrap');
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
    if (currentView === 'party') {
      buildPlayerFilter(outer, slot);
    } else {
      outer.querySelector('.pp-player-filter')?.remove();
    }

    const wrap = slot.querySelector('.timeline-wrap');
    bindDragScroll(wrap);
    bindWheelScroll(wrap);
    applyZoom(wrap);
    applyAllLayers(outer, wrap);
  }

  // --- Zoom ---

  function applyZoom(wrap) {
    if (!wrap) return;
    const inner = wrap.querySelector('.timeline');
    if (inner) inner.style.zoom = ZOOM_STEPS[zoomIdx] / 100;
  }

  // --- Layer visibility ---

  const LAYERS = ['synergy', 'debuff', 'cast'];

  function applyAllLayers(outer, wrap) {
    if (!wrap) return;
    LAYERS.forEach(key => {
      const cb = outer.querySelector(`input[data-layer="${key}"]`);
      wrap.classList.toggle(`pp-layer-${key}-hidden`, cb ? !cb.checked : false);
    });
  }

  // --- Controls bar (built once) ---

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
    zoom.innerHTML = `
      <button type="button" data-delta="-1">−</button>
      <span class="pp-zoom-label">${ZOOM_STEPS[zoomIdx]}%</span>
      <button type="button" data-delta="1">＋</button>`;
    zoom.querySelector('.pp-zoom-label').style.cssText =
      'min-width:44px;color:var(--text-secondary);font-size:13px;text-align:center';

    // Layer toggles
    const layerCtrl = document.createElement('div');
    layerCtrl.className = 'timeline-layer-controls';
    layerCtrl.innerHTML = [
      { key: 'synergy', label: 'シナジー' },
      { key: 'debuff',  label: 'デバフ' },
      { key: 'cast',    label: 'ボスキャスト' },
    ].map(({ key, label }) => `
      <label class="timeline-layer-toggle">
        <input type="checkbox" data-layer="${key}" checked>
        <span>${label}</span>
      </label>`).join('');

    bar.append(viewTabs, tlTabs, zoom, layerCtrl);
    outer.insertBefore(bar, outer.querySelector('.pp-wrap-slot'));

    // View tab click
    viewTabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn || btn.dataset.view === currentView) return;
      currentView = btn.dataset.view;
      viewTabs.querySelectorAll('.timeline-view-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      loadView(outer);
    });

    // TL tab click
    tlTabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-tltab]');
      if (!btn || btn.dataset.tltab === currentTab) return;
      currentTab = btn.dataset.tltab;
      tlTabs.querySelectorAll('.tab').forEach(b =>
        b.classList.toggle('active', b === btn));
      loadView(outer);
    });

    // Zoom click
    zoom.addEventListener('click', e => {
      const btn = e.target.closest('[data-delta]');
      if (!btn) return;
      const delta = parseInt(btn.dataset.delta, 10);
      zoomIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomIdx + delta));
      zoom.querySelector('.pp-zoom-label').textContent = `${ZOOM_STEPS[zoomIdx]}%`;
      applyZoom(outer.querySelector('.timeline-wrap'));
    });

    // Layer toggle change
    layerCtrl.addEventListener('change', e => {
      const cb = e.target.closest('[data-layer]');
      if (!cb) return;
      const wrap = outer.querySelector('.timeline-wrap');
      if (wrap) wrap.classList.toggle(`pp-layer-${cb.dataset.layer}-hidden`, !cb.checked);
    });
  }

  // --- Load view ---

  function loadView(outer) {
    const url = currentUrl();
    if (snapshotCache[url]) {
      injectSnapshot(outer, snapshotCache[url]);
      return;
    }
    outer.querySelector('.pp-wrap-slot').innerHTML =
      '<p class="premium-preview-loading">読み込み中...</p>';
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(html => { snapshotCache[url] = html; injectSnapshot(outer, html); })
      .catch(() => {
        outer.querySelector('.pp-wrap-slot').innerHTML =
          '<p class="premium-preview-loading">スナップショット未収集（準備中）</p>';
        outer.querySelector('.pp-phase-bar')?.remove();
        outer.querySelector('.pp-player-filter')?.remove();
      });
  }

  // --- Init ---

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
