(function () {
  const TEXT = {
    ja: {
      ready: 'Donation',
      pending: 'Donation（準備中）',
      ariaPending: 'Donation link is not configured yet.',
    },
    en: {
      ready: 'Donation',
      pending: 'Donation (coming soon)',
      ariaPending: 'Donation link is not configured yet.',
    },
  };

  function currentLang() {
    if (globalThis.state?.lang === 'en' || globalThis.state?.lang === 'ja') return globalThis.state.lang;
    return new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ja';
  }

  function applyDonationLinks() {
    const lang = currentLang();
    const text = TEXT[lang] || TEXT.ja;
    const url = String(globalThis.XIVSRD_DONATION_URL || '').trim();
    document.querySelectorAll('[data-donation-link]').forEach((link) => {
      if (url) {
        link.href = url;
        link.removeAttribute('aria-disabled');
        link.dataset.donationDisabled = 'false';
        link.onclick = null;
        link.textContent = text.ready;
        return;
      }
      link.href = '#';
      link.setAttribute('aria-disabled', 'true');
      link.dataset.donationDisabled = 'true';
      link.title = text.ariaPending;
      if (!link.dataset.premiumI18n) link.textContent = text.pending;
      link.onclick = (event) => event.preventDefault();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDonationLinks);
  } else {
    applyDonationLinks();
  }

  globalThis.DonationModule = { applyDonationLinks };
}());
