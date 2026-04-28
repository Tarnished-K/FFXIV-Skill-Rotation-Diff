const MODULE_NAME = 'AuthUI';

let _usageRemaining = null;

function authText(key, fallback, ...args) {
  const lang = globalThis.state?.lang || 'ja';
  const table = globalThis.I18N?.[lang] || globalThis.I18N?.ja || {};
  const value = table[key];
  if (typeof value === 'function') return value(...args);
  return value || fallback;
}

async function fetchUsageStatus(jwt) {
  try {
    const headers = {};
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const res = await fetch('/api/auth-status', { method: 'GET', headers });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

async function refreshAuthUI() {
  const auth = globalThis.AuthModule;
  if (!auth) return;
  const session = await auth.getSession();
  const jwt = session?.access_token || null;
  const user = session?.user || null;
  const usageData = await fetchUsageStatus(jwt);
  renderHeaderAuth(user, usageData);
}

async function getAuthStatus() {
  const auth = globalThis.AuthModule;
  const session = await auth?.getSession?.();
  const jwt = session?.access_token || null;
  return fetchUsageStatus(jwt);
}

async function requirePremiumFeature(featureName) {
  const status = await getAuthStatus();
  if (status?.isPremium) return true;
  const url = new URL('/premium.html', window.location.origin);
  url.searchParams.set('feature', featureName || 'premium');
  window.location.href = url.toString();
  return false;
}

function updateSidebarAuth(user, usageData) {
  const usernameEl = document.getElementById('sidebarUsername');
  const roleEl = document.getElementById('sidebarUserRole');
  const loginBtn = document.getElementById('sidebarLoginBtn');
  const loginLabel = loginBtn?.querySelector('span');
  if (!user) {
    if (usernameEl) usernameEl.textContent = '—';
    if (roleEl) roleEl.textContent = 'ゲスト';
    if (loginLabel) loginLabel.textContent = 'ログイン';
    if (loginBtn) loginBtn.onclick = () => openAuthModal('login');
  } else {
    const name = user.user_metadata?.full_name || user.email || '';
    if (usernameEl) usernameEl.textContent = name;
    if (roleEl) roleEl.textContent = usageData?.isPremium ? 'サポーター' : '無料会員';
    if (loginLabel) loginLabel.textContent = 'ログアウト';
    if (loginBtn) loginBtn.onclick = async () => {
      await globalThis.AuthModule.signOut();
      renderHeaderAuth(null, null);
    };
  }
}

function renderHeaderAuth(user, usageData) {
  const container = document.getElementById('headerAuthArea');
  updateSidebarAuth(user, usageData);
  if (globalThis.state) {
    globalThis.state.isPremium = Boolean(user && usageData?.isPremium);
  }
  renderHeaderStatus(usageData);
  renderHeaderUsage(usageData);
  updateAdVisibility(Boolean(usageData?.isPremium));
  globalThis.updateBookmarkControls?.();
  globalThis.updateTimelineLayerControls?.();
  if (globalThis.state?.timelineA?.length && !globalThis.el?.timelineWrap?.classList?.contains('hidden')) {
    if (globalThis.state.timelineView === 'party' && globalThis.state.partyTimelineA?.length && globalThis.state.partyTimelineB?.length) {
      globalThis.renderPartyTimeline?.();
    } else {
      globalThis.renderTimeline?.();
    }
  }
  if (!container) return;

  if (!user) {
    container.innerHTML =
      '<button id="loginBtn" type="button" class="button-link ghost auth-btn">' + escapeHtml(authText('authLoginSignup', 'ログイン / 会員登録')) + '</button>';
    document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
  } else {
    const displayName = user.user_metadata?.full_name || user.email || '';
    container.innerHTML =
      '<span class="user-display">' + escapeHtml(displayName) + '</span>' +
      '<button id="logoutBtn" type="button" class="button-link ghost auth-btn logout-btn">' + escapeHtml(authText('logoutBtn', 'ログアウト')) + '</button>';
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await globalThis.AuthModule.signOut();
      renderHeaderAuth(null, null);
    });
  }
  requestAnimationFrame(_removeRogueHeaderAds);
}

let _rogueAdObserver = null;

function _removeRogueHeaderAds() {
  document.querySelectorAll('ins.adsbygoogle').forEach((el) => {
    if (!el.closest('.header-ad') && !el.closest('.footer-ad')) el.remove();
  });
}

function blockHeaderAutoAds() {
  _removeRogueHeaderAds();
  if (_rogueAdObserver) return;
  _rogueAdObserver = new MutationObserver(_removeRogueHeaderAds);
  _rogueAdObserver.observe(document.body, { childList: true, subtree: true });
}

function updateAdVisibility(isPremium) {
  document.querySelectorAll('.header-ad, .footer-ad').forEach((el) => {
    el.style.display = isPremium ? 'none' : '';
  });
}

function renderHeaderStatus(usageData) {
  const container = document.getElementById('headerStatusArea');
  if (!container) return;
  if (!usageData) {
    container.textContent = '';
    return;
  }
  const label = authText('statusLabel', 'ステータス：');
  if (usageData.isPremium) {
    container.textContent = label + authText('statusSupporter', 'サポーター');
    return;
  }
  container.innerHTML = escapeHtml(label + authText('statusFree', '無料版')) +
    ' <a class="status-register-link" href="/premium.html?feature=status">' +
    escapeHtml(authText('statusRegister', '登録')) +
    '</a>';
}

function renderHeaderUsage(usageData) {
  const container = document.getElementById('headerUsageArea');
  if (!container) return;
  if (!usageData || typeof usageData.remaining !== 'number') {
    container.textContent = '';
    return;
  }
  const remaining = usageData.remaining;
  container.textContent = authText('usageRemaining', '本日残り回数：' + remaining, remaining);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openAuthModal(mode) {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.dataset.mode = mode || 'login';
  updateAuthModalContent(modal.dataset.mode);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('authEmailInput')?.focus();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.getElementById('authError')?.textContent && (document.getElementById('authError').textContent = '');
}

function updateAuthModalContent(mode) {
  const title = document.getElementById('authModalTitle');
  const submitBtn = document.getElementById('authSubmitBtn');
  const switchText = document.getElementById('authSwitchText');
  if (mode === 'signup') {
    if (title) title.textContent = '会員登録';
    if (submitBtn) submitBtn.textContent = '登録する';
    if (switchText) switchText.innerHTML = 'すでにアカウントをお持ちの方は <a href="#" id="authSwitchLink">ログイン</a>';
  } else {
    if (title) title.textContent = 'ログイン';
    if (submitBtn) submitBtn.textContent = 'ログイン';
    if (switchText) switchText.innerHTML = 'アカウントをお持ちでない方は <a href="#" id="authSwitchLink">会員登録</a>';
  }
  document.getElementById('authSwitchLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.dataset.mode = modal.dataset.mode === 'login' ? 'signup' : 'login';
    updateAuthModalContent(modal.dataset.mode);
  });
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const modal = document.getElementById('authModal');
  const mode = modal?.dataset.mode || 'login';
  const email = document.getElementById('authEmailInput')?.value?.trim() || '';
  const password = document.getElementById('authPasswordInput')?.value || '';
  const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (!email || !password) {
    if (errorEl) errorEl.textContent = 'メールアドレスとパスワードを入力してください。';
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  const auth = globalThis.AuthModule;
  const result = mode === 'signup'
    ? await auth.signUpWithEmail(email, password)
    : await auth.signInWithEmail(email, password);

  if (submitBtn) submitBtn.disabled = false;

  if (result.error) {
    if (errorEl) errorEl.textContent = result.error.message || 'エラーが発生しました。';
    return;
  }

  if (mode === 'signup') {
    if (errorEl) {
      errorEl.style.color = 'green';
      errorEl.textContent = '確認メールを送信しました。メールのリンクをクリックして登録を完了してください。';
    }
    return;
  }

  closeAuthModal();
}

async function initAuthUI() {
  blockHeaderAutoAds();
  const auth = globalThis.AuthModule;
  await auth.init();

  const session = await auth.getSession();
  const jwt = session?.access_token || null;
  const user = session?.user || null;
  const usageData = await fetchUsageStatus(jwt);
  renderHeaderAuth(user, usageData);

  auth.onAuthStateChange(async (newUser) => {
    const newSession = await auth.getSession();
    const newJwt = newSession?.access_token || null;
    const newUsage = await fetchUsageStatus(newJwt);
    renderHeaderAuth(newUser, newUsage);
  });

  document.getElementById('authForm')?.addEventListener('submit', handleAuthSubmit);
  document.getElementById('authCloseBtn')?.addEventListener('click', closeAuthModal);
  document.getElementById('authGoogleBtn')?.addEventListener('click', () => auth.signInWithGoogle());
  document.getElementById('authModalBackdrop')?.addEventListener('click', closeAuthModal);
}

globalThis.AuthUIModule = {
  initAuthUI,
  openAuthModal,
  closeAuthModal,
  renderHeaderAuth,
  refreshAuthUI,
  getAuthStatus,
  requirePremiumFeature,
};
