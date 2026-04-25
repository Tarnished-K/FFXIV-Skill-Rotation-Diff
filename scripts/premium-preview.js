// Premium page: injects a captured timeline HTML snapshot for visual fidelity.
// To update: run __captureTimelineHTML() in the live app console, save the downloaded
// file as assets/premium-preview-timeline.html, then commit.
(function PremiumPreview() {
  'use strict';

  const SNAPSHOT_URL = './assets/premium-preview-timeline.html';

  function bindDragScroll(wrap) {
    let dragging = false, startX = 0, scrollLeft = 0;
    wrap.addEventListener('mousedown', e => {
      dragging = true;
      startX = e.pageX - wrap.offsetLeft;
      scrollLeft = wrap.scrollLeft;
      wrap.style.cursor = 'grabbing';
    });
    wrap.addEventListener('mouseleave', () => { dragging = false; wrap.style.cursor = 'grab'; });
    wrap.addEventListener('mouseup', () => { dragging = false; wrap.style.cursor = 'grab'; });
    wrap.addEventListener('mousemove', e => {
      if (!dragging) return;
      e.preventDefault();
      const x = e.pageX - wrap.offsetLeft;
      wrap.scrollLeft = scrollLeft - (x - startX);
    });
  }

  function injectSnapshot(container, html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const wrap = doc.querySelector('.timeline-wrap');
    if (!wrap) {
      container.innerHTML = '<p style="color:#f88;padding:16px">スナップショットに .timeline-wrap が見つかりませんでした。</p>';
      return;
    }
    container.innerHTML = '';
    container.appendChild(document.adoptNode(wrap));
    const injected = container.querySelector('.timeline-wrap');
    if (injected) bindDragScroll(injected);
  }

  function showPlaceholder(container) {
    container.innerHTML = [
      '<div style="padding:32px;text-align:center;color:#aaa;border:1px dashed #444;border-radius:8px;background:#1a1a2e">',
      '<p style="font-size:1rem;margin:0 0 8px">比較結果プレビュー（準備中）</p>',
      '<p style="font-size:0.8rem;margin:0">実際の比較結果と同じUIが表示されます</p>',
      '</div>',
    ].join('');
  }

  function init() {
    const container = document.getElementById('premiumPreviewOuter');
    if (!container) return;

    fetch(SNAPSHOT_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(html => injectSnapshot(container, html))
      .catch(() => showPlaceholder(container));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
