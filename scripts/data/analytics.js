// Analytics event helpers
const { postJson } = globalThis;
const ANALYTICS_SESSION_KEY = 'ffxiv_rotation_diff_session_id';
let analyticsSessionId = '';

function createAnalyticsSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getAnalyticsSessionId() {
  if (analyticsSessionId) return analyticsSessionId;
  try {
    const existing = sessionStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) {
      analyticsSessionId = existing;
      return analyticsSessionId;
    }
  } catch {}

  analyticsSessionId = createAnalyticsSessionId();
  try {
    sessionStorage.setItem(ANALYTICS_SESSION_KEY, analyticsSessionId);
  } catch {}
  return analyticsSessionId;
}

async function sendAnalyticsEvent(eventType, details = {}) {
  try {
    const baseDetails = {
      sessionId: getAnalyticsSessionId(),
    };
    if (typeof state !== 'undefined' && state?.lang) {
      baseDetails.lang = state.lang;
    }
    await postJson('/api/log-event', {
      eventType,
      pathname: window.location.pathname,
      details: {
        ...baseDetails,
        ...details,
      },
    });
  } catch (error) {
    logDebug('analytics skipped', { eventType, error: error.message });
  }
}

Object.assign(globalThis, {
  createAnalyticsSessionId,
  getAnalyticsSessionId,
  sendAnalyticsEvent,
});

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const donationTarget = event.target?.closest?.('[data-donation-link], a[href*="#donation"]');
    if (donationTarget) {
      sendAnalyticsEvent('donation_cta_clicked', {
        href: donationTarget.getAttribute('href') || '',
        source: donationTarget.id || 'donation-link',
        text: (donationTarget.textContent || '').trim().slice(0, 80),
      });
      return;
    }
    const target = event.target?.closest?.('[data-supporter-cta], a[href*="premium.html"]');
    if (!target) return;
    const href = target.getAttribute('href') || '';
    const source = target.getAttribute('data-supporter-cta') || target.id || 'premium-link';
    sendAnalyticsEvent('supporter_cta_clicked', {
      href,
      source,
      text: (target.textContent || '').trim().slice(0, 80),
    });
  });
}
