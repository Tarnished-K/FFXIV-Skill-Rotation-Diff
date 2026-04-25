// Premium page: injects a captured timeline HTML snapshot for visual fidelity.
// Snapshots: assets/premium-preview-timeline.html (personal), assets/premium-preview-party.html (party)
// To update: run __captureTimelineHTML('personal') or __captureTimelineHTML('party') in the live app,
// save the downloaded files to the assets/ folder, then commit.
(function PremiumPreview() {
  'use strict';

  const URLS = {
    personal: './assets/premium-preview-timeline.html',
    party:    './assets/premium-preview-party.html',
  };
  const ZOOM_STEPS = [50, 75, 100, 125, 150, 200];
  let zoomIdx = 2; // 100%
  const snapshotCache = {};

  // --- Drag scroll ---
  function bindDragScroll(wrap) {
    let dragging = false, startX = 0, scrollLeft = 0;
    wrap.addEventListener('mousedown', e => {
      dragging = true;
      startX = e.pageX - wrap.offsetLeft;
      scrollLeft = wrap.scrollLeft;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('mouseleave', () => { dragging = false; wrap.style.cursor = ''; });
    wrap.addEventListener('mouseup',    () => { dragging = false; wrap.style.cursor = ''; });
    wrap.addEventListener('mousemove', e => {
      if (!dragging) return;
      e.preventDefault();
      wrap.scrollLeft = scrollLeft - (e.pageX - wrap.offsetLeft - startX);
    });
  }

  // --- Inject HTML snapshot ---
  function injectSnapshot(outer, html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const src = doc.querySelector('.timeline-wrap');
    const slot = outer.querySelector('.pp-wrap-slot');
    if (!src) {
      slot.innerHTML = '<p class="premium-preview-loading">スナップショット未収集（準備中）</p>';
      return;
    }
    slot.innerHTML = '';
    slot.appendChild(document.adoptNode(src));

    const wrap = slot.querySelector('.timeline-wrap');
    bindDragScroll(wrap);
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

  // --- Controls bar ---
  function buildControls(outer) {
    const bar = document.createElement('div');
    bar.className = 'pp-controls-bar';

    // 個人/PT view tabs (reuse main-app CSS)
    const viewTabs = document.createElement('div');
    viewTabs.className = 'timeline-view-tabs';
    viewTabs.innerHTML = `
      <button class="timeline-view-btn active" data-view="personal">個人比較</button>
      <button class="timeline-view-btn" data-view="party">PT比較</button>`;

    // Zoom (reuse main-app CSS)
    const zoom = document.createElement('div');
    zoom.className = 'zoom-controls';
    zoom.innerHTML = `
      <button type="button" class="pp-zoom-btn" data-delta="-1">−</button>
      <span class="pp-zoom-label" style="min-width:44px;color:var(--text-secondary);font-size:13px;text-align:center">${ZOOM_STEPS[zoomIdx]}%</span>
      <button type="button" class="pp-zoom-btn" data-delta="1">＋</button>`;

    // Layer toggles (reuse main-app CSS)
    const layers = document.createElement('div');
    layers.className = 'timeline-layer-controls';
    layers.innerHTML = [
      { key: 'synergy', label: 'シナジー' },
      { key: 'debuff',  label: 'デバフ' },
      { key: 'cast',    label: 'ボスキャスト' },
    ].map(({ key, label }) => `
      <label class="timeline-layer-toggle">
        <input type="checkbox" data-layer="${key}" checked>
        <span>${label}</span>
      </label>`).join('');

    bar.append(viewTabs, zoom, layers);
    outer.insertBefore(bar, outer.querySelector('.pp-wrap-slot'));

    // --- Event bindings ---

    // View tab switching
    let currentView = 'personal';
    viewTabs.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn || btn.dataset.view === currentView) return;
      currentView = btn.dataset.view;
      viewTabs.querySelectorAll('.timeline-view-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      loadView(outer, URLS[currentView]);
    });

    // Zoom buttons
    zoom.addEventListener('click', e => {
      const btn = e.target.closest('[data-delta]');
      if (!btn) return;
      const delta = parseInt(btn.dataset.delta, 10);
      zoomIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomIdx + delta));
      zoom.querySelector('.pp-zoom-label').textContent = `${ZOOM_STEPS[zoomIdx]}%`;
      applyZoom(outer.querySelector('.timeline-wrap'));
    });

    // Layer toggles
    layers.addEventListener('change', e => {
      const cb = e.target.closest('[data-layer]');
      if (!cb) return;
      const wrap = outer.querySelector('.timeline-wrap');
      if (wrap) wrap.classList.toggle(`pp-layer-${cb.dataset.layer}-hidden`, !cb.checked);
    });
  }

  // --- Load a view ---
  function loadView(outer, url) {
    if (snapshotCache[url]) {
      injectSnapshot(outer, snapshotCache[url]);
      return;
    }
    const slot = outer.querySelector('.pp-wrap-slot');
    slot.innerHTML = '<p class="premium-preview-loading">読み込み中...</p>';
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(html => { snapshotCache[url] = html; injectSnapshot(outer, html); })
      .catch(() => {
        slot.innerHTML = '<p class="premium-preview-loading">スナップショット未収集（準備中）</p>';
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
    loadView(outer, URLS.personal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
