(function attachFeedbackAdmin(root, factory) {
  const exports = factory();
  root.FeedbackAdmin = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  if (root.document && root.FeedbackShared) {
    if (root.document.body?.dataset?.requiresAdminAuth === 'true') {
      root.document.addEventListener('admin-auth:ready', (event) => {
        exports.init({
          document: root.document,
          fetchImpl: event.detail.fetchImpl,
          shared: root.FeedbackShared,
        });
      }, { once: true });
    } else {
      exports.init({
        document: root.document,
        fetchImpl: root.fetch.bind(root),
        shared: root.FeedbackShared,
      });
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFeedbackAdmin() {
  function requiresAdminAuth(document) {
    return document?.body?.dataset?.requiresAdminAuth === 'true';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sortFeedbackItems(items) {
    return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
      if (Boolean(left.is_read) !== Boolean(right.is_read)) {
        return left.is_read ? 1 : -1;
      }

      return Date.parse(right.created_at || 0) - Date.parse(left.created_at || 0);
    });
  }

  function buildFeedbackEntryMarkup(item, { isGeneral, categoryLabels }) {
    const subject = escapeHtml(item.subject);
    const body = escapeHtml(item.body);
    const category = escapeHtml(categoryLabels[item.category] || item.category);
    const createdAt = escapeHtml(item.created_at || '');
    const readLabel = item.is_read ? '既読' : '未読';
    const deleteAfter = item.delete_after_at
      ? `7日後削除予定: ${escapeHtml(item.delete_after_at)}`
      : '削除予定なし';
    const actionButton = isGeneral
      ? `<button type="button" class="ghost" data-feedback-action="trash" data-feedback-id="${item.id}">ゴミ箱へ移動</button>`
      : `<button type="button" class="ghost" data-feedback-action="restore" data-feedback-id="${item.id}">一般へ戻す</button>`;
    const aiReasonRow = !isGeneral && item.ai_reason
      ? `<p class="feedback-entry-meta">AI 判定理由: ${escapeHtml(item.ai_reason)}</p>`
      : '';

    return `
      <article class="feedback-entry-card" data-feedback-id="${item.id}">
        <div class="feedback-entry-head">
          <strong>${subject}</strong>
          <span>${readLabel}</span>
        </div>
        <p class="feedback-entry-meta">${category} / ${createdAt}</p>
        <p class="feedback-entry-body">${body}</p>
        ${aiReasonRow}
        <p class="feedback-entry-meta">${deleteAfter}</p>
        <div class="feedback-entry-actions">
          <button type="button" data-feedback-action="toggle-read" data-feedback-id="${item.id}" data-feedback-read="${item.is_read ? 'false' : 'true'}">
            ${item.is_read ? '未読に戻す' : '既読にする'}
          </button>
          ${actionButton}
        </div>
      </article>
    `;
  }

  function init({ document, fetchImpl, shared }) {
    const state = {
      activeTab: 'general',
      items: [],
    };

    const messageEl = document.getElementById('feedbackAdminMessage');
    const generalSection = document.getElementById('feedbackGeneralSections');
    const trashSection = document.getElementById('feedbackTrashSection');
    const purgeButton = document.getElementById('feedbackPurgeBtn');

    function setMessage(text) {
      if (messageEl) {
        messageEl.textContent = text || '';
      }
    }

    function setSummary(summary) {
      document.getElementById('feedbackUnreadCount').textContent = String(summary?.unread_count ?? 0);
      document.getElementById('feedbackGeneralCount').textContent = String(summary?.general_count ?? 0);
      document.getElementById('feedbackTrashCount').textContent = String(summary?.trash_count ?? 0);
      document.getElementById('feedbackPendingPurgeCount').textContent = String(summary?.pending_purge_count ?? 0);
    }

    function renderGeneral(items) {
      const grouped = {
        bug_report: [],
        feature_request: [],
        question: [],
        other: [],
      };

      sortFeedbackItems(items).forEach((item) => {
        if (grouped[item.category]) {
          grouped[item.category].push(item);
        }
      });

      const sections = Object.keys(grouped).map((category) => {
        const rows = grouped[category];
        const cards = rows.length
          ? rows.map((item) => buildFeedbackEntryMarkup(item, {
            isGeneral: true,
            categoryLabels: shared.CATEGORY_LABELS,
          })).join('')
          : '<p class="analytics-empty">該当なし</p>';

        return `
          <section class="feedback-category-block">
            <h2>${shared.CATEGORY_LABELS[category] || category}</h2>
            <div class="feedback-card-list">${cards}</div>
          </section>
        `;
      });

      generalSection.innerHTML = sections.join('');
    }

    function renderTrash(items) {
      const sorted = sortFeedbackItems(items);
      trashSection.innerHTML = sorted.length
        ? `<div class="feedback-card-list">${sorted.map((item) => buildFeedbackEntryMarkup(item, {
          isGeneral: false,
          categoryLabels: shared.CATEGORY_LABELS,
        })).join('')}</div>`
        : '<p class="analytics-empty">ゴミ箱は空です。</p>';
    }

    function render() {
      const generalItems = state.items.filter((item) => item.bucket !== 'trash');
      const trashItems = state.items.filter((item) => item.bucket === 'trash');

      renderGeneral(generalItems);
      renderTrash(trashItems);

      const showGeneral = state.activeTab === 'general';
      generalSection.classList.toggle('hidden', !showGeneral);
      trashSection.classList.toggle('hidden', showGeneral);
    }

    async function loadFeedback() {
      setMessage('読み込み中...');
      const response = await fetchImpl('/api/feedback-admin-list?limit=100&offset=0', { cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || 'Feedback list request failed.');
      }
      state.items = Array.isArray(json.items) ? json.items : [];
      setSummary(json.summary || {});
      render();
      setMessage('');
    }

    async function postAction(path, payload) {
      const response = await fetchImpl(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error || 'Feedback admin request failed.');
      }
      return json;
    }

    document.addEventListener('click', async (event) => {
      const tabButton = event.target.closest('[data-feedback-tab]');
      if (tabButton) {
        state.activeTab = tabButton.getAttribute('data-feedback-tab');
        document.querySelectorAll('[data-feedback-tab]').forEach((node) => {
          node.classList.toggle('active', node === tabButton);
        });
        render();
        return;
      }

      const actionButton = event.target.closest('[data-feedback-action]');
      if (!actionButton) {
        return;
      }

      const id = Number(actionButton.getAttribute('data-feedback-id'));
      const action = actionButton.getAttribute('data-feedback-action');

      if (action === 'toggle-read') {
        await postAction('/api/feedback-admin-mark-read', {
          id,
          isRead: actionButton.getAttribute('data-feedback-read') === 'true',
        });
      }

      if (action === 'trash') {
        await postAction('/api/feedback-admin-move-to-trash', {
          id,
          reason: 'Moved from admin UI',
        });
      }

      if (action === 'restore') {
        await postAction('/api/feedback-admin-restore', { id });
      }

      await loadFeedback();
    });

    purgeButton?.addEventListener('click', async () => {
      const json = await postAction('/api/feedback-admin-purge');
      setMessage(typeof json.deletedCount === 'number'
        ? `${json.deletedCount} 件を削除しました。`
        : '期限切れ削除を実行しました。');
      await loadFeedback();
    });

    loadFeedback().catch(() => {
      setMessage('一覧の取得に失敗しました。');
    });
  }

  return {
    buildFeedbackEntryMarkup,
    escapeHtml,
    init,
    requiresAdminAuth,
    sortFeedbackItems,
  };
}));
