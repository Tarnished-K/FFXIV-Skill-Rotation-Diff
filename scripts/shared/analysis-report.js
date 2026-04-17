(function attachAnalysisReport(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  if (root.document) {
    root.document.addEventListener('admin-auth:ready', (event) => {
      factory().init({
        document: root.document,
        fetchImpl: event.detail.fetchImpl,
      });
    }, { once: true });
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAnalysisReport() {
  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function renderMarkdown(container, document, md) {
    const lines = md.split('\n');
    let currentUl = null;

    function flushList() {
      if (currentUl) {
        container.appendChild(currentUl);
        currentUl = null;
      }
    }

    function appendText(tag, text, strong = false) {
      flushList();
      const el = document.createElement(tag);
      if (strong) {
        const parts = text.split(/\*\*(.+?)\*\*/);
        parts.forEach((part, i) => {
          if (i % 2 === 1) {
            const s = document.createElement('strong');
            s.textContent = part;
            el.appendChild(s);
          } else if (part) {
            el.appendChild(document.createTextNode(part));
          }
        });
      } else {
        el.textContent = text;
      }
      container.appendChild(el);
    }

    for (const line of lines) {
      if (line.startsWith('### ')) {
        appendText('h3', line.slice(4));
      } else if (line.startsWith('## ')) {
        appendText('h2', line.slice(3));
      } else if (line.startsWith('- ')) {
        if (!currentUl) currentUl = document.createElement('ul');
        const li = document.createElement('li');
        li.textContent = line.slice(2);
        currentUl.appendChild(li);
      } else if (line.trim()) {
        appendText('p', line, true);
      } else {
        flushList();
      }
    }

    flushList();
  }

  async function init({ document, fetchImpl }) {
    const metaEl = document.getElementById('aiReportMeta');
    const bodyEl = document.getElementById('aiReportBody');
    if (!metaEl || !bodyEl) return;

    try {
      const response = await fetchImpl('/api/analysis-report', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.ok) {
        metaEl.textContent = json.error || 'レポートの取得に失敗しました。';
        return;
      }

      if (!json.report) {
        metaEl.textContent = 'まだレポートがありません。次回の自動分析をお待ちください。';
        return;
      }

      const { report } = json;
      metaEl.textContent = [
        `対象期間: ${formatDate(report.period_start)} 〜 ${formatDate(report.period_end)}`,
        `生成: ${formatDate(report.created_at)}`,
        `モデル: ${report.model}`,
      ].join('　|　');

      renderMarkdown(bodyEl, document, report.report_md);
    } catch {
      metaEl.textContent = 'レポートの取得中にエラーが発生しました。';
    }
  }

  return { init };
}));
