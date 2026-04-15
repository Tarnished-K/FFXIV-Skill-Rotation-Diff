(function () {
  const DEFAULT_WINDOW_DAYS = 14;
  const ALLOWED_WINDOW_DAYS = new Set([7, 14, 30]);

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('ja-JP');
  }

  function formatPercent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function formatPhaseSource(value) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized === 'none') return 'none';
    return normalized;
  }

  function getSelectedDays() {
    const url = new URL(window.location.href);
    const days = Number(url.searchParams.get('days') || DEFAULT_WINDOW_DAYS);
    return ALLOWED_WINDOW_DAYS.has(days) ? days : DEFAULT_WINDOW_DAYS;
  }

  function syncDaysButtons(days) {
    document.querySelectorAll('[data-analytics-days]').forEach((button) => {
      const active = Number(button.dataset.analyticsDays) === days;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function syncDaysUrl(days) {
    const url = new URL(window.location.href);
    url.searchParams.set('days', String(days));
    window.history.replaceState({}, '', url);
  }

  function renderTable(containerId, columns, rows, emptyText) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!rows || rows.length === 0) {
      container.innerHTML = `<p class="analytics-empty">${emptyText}</p>`;
      return;
    }
    const head = columns.map((column) => `<th>${column.label}</th>`).join('');
    const body = rows.map((row) => {
      const cells = columns.map((column) => `<td>${column.render(row)}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    container.innerHTML = `
      <table class="analytics-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function renderEventList(containerId, items, renderItem, emptyText) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items || items.length === 0) {
      container.innerHTML = `<p class="analytics-empty">${emptyText}</p>`;
      return;
    }
    container.innerHTML = items.map(renderItem).join('');
  }

  function renderDailyChart(rows) {
    const container = document.getElementById('analyticsDailyChart');
    if (!container) return;
    if (!rows || rows.length === 0) {
      container.innerHTML = '<p class="analytics-empty">日次データはまだありません。</p>';
      return;
    }

    const maxValue = Math.max(1, ...rows.map((row) => Math.max(row.pageViews, row.comparisons, row.errors)));
    container.innerHTML = rows.map((row) => `
      <div class="analytics-bar-row">
        <div class="analytics-bar-label">${row.label}</div>
        <div class="analytics-bar-stack">
          <div class="analytics-bar page" style="width:${(row.pageViews / maxValue) * 100}%">
            <span>${row.pageViews}</span>
          </div>
          <div class="analytics-bar compare" style="width:${(row.comparisons / maxValue) * 100}%">
            <span>${row.comparisons}</span>
          </div>
          <div class="analytics-bar error" style="width:${(row.errors / maxValue) * 100}%">
            <span>${row.errors}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderSummary(analytics) {
    const totals = analytics.totals || {};
    setText('metricPageViews', formatNumber(totals.pageViews));
    setText('metricReportsLoaded', formatNumber(totals.reportsLoaded));
    setText('metricComparisons', formatNumber(totals.comparisons));
    setText('metricErrors', formatNumber(totals.apiErrors));
    setText('metricSessions', formatNumber(totals.sessions));
    setText('metricComparePerView', formatPercent(totals.comparePerViewRate));
    setText('metricComparePerLoad', formatPercent(totals.comparePerLoadRate));
    setText('metricSampledEvents', formatNumber(analytics.sampledEvents));
    setText('analyticsWindowLabel', `過去 ${analytics.windowDays} 日`);

    const summary = [
      `${formatNumber(totals.sessions)} セッション`,
      `直近 ${analytics.windowDays} 日で ${formatNumber(totals.pageViews)} PV`,
      `${formatNumber(totals.reportsLoaded)} 回の読み込み`,
      `${formatNumber(totals.comparisons)} 回の比較完了`,
      totals.apiErrors ? `${formatNumber(totals.apiErrors)} 件の API エラー` : 'API エラーは確認されていません',
      analytics.lastEventAt ? `最終イベント: ${formatDateTime(analytics.lastEventAt)}` : '',
    ].filter(Boolean).join(' / ');
    setText('analyticsSummaryText', summary);

    renderDailyChart(analytics.daily || []);

    renderTable(
      'analyticsTopJobs',
      [
        { label: 'Job', render: (row) => escapeHtml(row.job) },
        { label: 'Count', render: (row) => formatNumber(row.count) },
      ],
      analytics.topJobs || [],
      'まだ比較完了イベントがありません。'
    );

    renderTable(
      'analyticsTopPaths',
      [
        { label: 'Path', render: (row) => escapeHtml(row.pathname) },
        { label: 'Count', render: (row) => formatNumber(row.count) },
      ],
      analytics.topPaths || [],
      'まだアクセス記録がありません。'
    );

    renderTable(
      'analyticsTopErrorCauses',
      [
        { label: 'Cause', render: (row) => escapeHtml(row.label) },
        { label: 'Count', render: (row) => formatNumber(row.count) },
      ],
      analytics.topErrorCauses || [],
      '直近の api_error はありません。'
    );

    renderEventList(
      'analyticsRecentComparisons',
      analytics.recentComparisons || [],
      (item) => {
        const details = item.details || {};
        const pair = [details.jobA, details.jobB].filter(Boolean).map(escapeHtml).join(' vs ') || 'Unknown pair';
        const encounter = details.encounterA ? `Encounter ${escapeHtml(details.encounterA)}` : 'Encounter unknown';
        const phaseSources = `${formatPhaseSource(details.phaseSourceA)} / ${formatPhaseSource(details.phaseSourceB)}`;
        return `
          <article class="analytics-event-item">
            <div class="analytics-event-head">
              <strong>${pair}</strong>
              <span>${formatDateTime(item.createdAt)}</span>
            </div>
            <div class="analytics-event-body">${encounter} / phasesShown: ${escapeHtml(details.phasesShown ?? '-')} / phaseSource: ${escapeHtml(phaseSources)} / TL: ${escapeHtml(details.timelineCountA ?? '-')} / ${escapeHtml(details.timelineCountB ?? '-')}</div>
          </article>
        `;
      },
      'まだ比較完了イベントはありません。'
    );

    renderEventList(
      'analyticsRecentLoads',
      analytics.recentLoads || [],
      (item) => {
        const details = item.details || {};
        const zones = [details.zoneA, details.zoneB].filter(Boolean).map(escapeHtml).join(' / ') || 'Zone unknown';
        return `
          <article class="analytics-event-item">
            <div class="analytics-event-head">
              <strong>${escapeHtml(details.reportCodeA || '-')} vs ${escapeHtml(details.reportCodeB || '-')}</strong>
              <span>${formatDateTime(item.createdAt)}</span>
            </div>
            <div class="analytics-event-body">${zones} / fights: ${escapeHtml(details.fightsA ?? '-')} / ${escapeHtml(details.fightsB ?? '-')}</div>
          </article>
        `;
      },
      '直近の reports_loaded はありません。'
    );

    renderEventList(
      'analyticsRecentErrors',
      analytics.recentErrors || [],
      (item) => {
        const details = item.details || {};
        const stage = escapeHtml(details.stage || 'unknown');
        const message = escapeHtml(details.message || 'No message');
        return `
          <article class="analytics-event-item analytics-event-item-error">
            <div class="analytics-event-head">
              <strong>${stage}</strong>
              <span>${formatDateTime(item.createdAt)}</span>
            </div>
            <div class="analytics-event-body">${message}</div>
          </article>
        `;
      },
      '直近の api_error はありません。'
    );
  }

  async function loadAnalytics(days) {
    const response = await fetch(`/api/analytics-summary?days=${encodeURIComponent(days)}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    const json = await response.json();
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || 'Analytics summary request failed.');
    }
    return json.analytics;
  }

  async function refreshAnalytics(days) {
    try {
      syncDaysButtons(days);
      const analytics = await loadAnalytics(days);
      renderSummary(analytics);
      syncDaysUrl(days);
    } catch (error) {
      setText('analyticsSummaryText', `集計の読み込みに失敗しました: ${error.message}`);
      setText('analyticsWindowLabel', '読み込み失敗');
    }
  }

  function bindDaysButtons() {
    document.querySelectorAll('[data-analytics-days]').forEach((button) => {
      button.addEventListener('click', () => {
        const days = Number(button.dataset.analyticsDays);
        if (!ALLOWED_WINDOW_DAYS.has(days)) return;
        refreshAnalytics(days);
      });
    });
  }

  async function initAnalyticsDashboard() {
    if (!document.body.classList.contains('analytics-page')) return;
    bindDaysButtons();
    await refreshAnalytics(getSelectedDays());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalyticsDashboard, { once: true });
  } else {
    initAnalyticsDashboard();
  }
})();
