const MODULE_NAME = 'AuthUI';

let _usageRemaining = null;

async function fetchUsageStatus(jwt) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
    const res = await fetch('/api/check-usage', { method: 'POST', headers, body: '{}' });
    if (res.ok || res.status === 429) {
      const data = await res.json();
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function renderHeaderAuth(user, usageData) {
  const container = document.getElementById('headerAuthArea');
  if (!container) return;

  if (!user) {
    container.innerHTML =
      '<button id="loginBtn" type="button" class="button-link ghost auth-btn">ログイン</button>' +
      '<button id="signupBtn" type="button" class="button-link auth-btn">会員登録</button>';
    if (usageData !== null) {
      const remaining = usageData.remaining;
      const badge = document.createElement('span');
      badge.className = 'usage-badge';
      badge.textContent = '今日あと' + (remaining >= 9999 ? '無制限' : remaining + '回');
      container.prepend(badge);
    }
    document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('signupBtn')?.addEventListener('click', () => openAuthModal('signup'));
  } else {
    const displayName = user.user_metadata?.full_name || user.email || '';
    const isPremium = usageData && usageData.isPremium;
    const remaining = usageData ? usageData.remaining : null;
    const badge = isPremium
      ? '<span class="plan-badge premium">有料会員</span>'
      : '<span class="plan-badge free">無料会員</span>';
    const usageBadge = remaining !== null
      ? '<span class="usage-badge">今日あと' + (remaining >= 9999 ? '無制限' : remaining + '回') + '</span>'
      : '';
    container.innerHTML =
      usageBadge +
      '<span class="user-display">' + escapeHtml(displayName) + '</span>' +
      badge +
      '<button id="logoutBtn" type="button" class="button-link ghost auth-btn">ログアウト</button>';
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await globalThis.AuthModule.signOut();
      renderHeaderAuth(null, null);
    });
  }
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

globalThis.AuthUIModule = { initAuthUI, openAuthModal, closeAuthModal, renderHeaderAuth };
