(function attachAdminAuth(root, factory) {
  const exports = factory(root);
  root.AdminAuth = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  if (root.document) {
    exports.init({
      document: root.document,
      fetchImpl: root.fetch.bind(root),
      locationObject: root.location,
    });
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAdminAuth(root) {
  const STORAGE_KEY = 'ffxiv_srd_admin_session';
  const REFRESH_WINDOW_MS = 60 * 1000;
  const memoryStorage = {
    value: '',
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = String(value);
    },
    removeItem() {
      this.value = '';
    },
  };

  function getStorage() {
    try {
      if (root.sessionStorage) {
        return root.sessionStorage;
      }
    } catch {
      return memoryStorage;
    }

    return memoryStorage;
  }

  function requiresAdminAuth(document) {
    return document?.body?.dataset?.requiresAdminAuth === 'true';
  }

  function normalizeSession(payload) {
    const session = payload?.session || payload;
    if (!session?.access_token || !session?.refresh_token) {
      return null;
    }

    const expiresAtSeconds = Number(session.expires_at || 0);
    const expiresInSeconds = Number(session.expires_in || 0);
    const expiresAt = expiresAtSeconds > 0
      ? expiresAtSeconds * 1000
      : Date.now() + Math.max(0, expiresInSeconds) * 1000;

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt,
      user: session.user || null,
    };
  }

  function isSessionExpiringSoon(session, now = Date.now()) {
    return !session || !session.expiresAt || session.expiresAt - now < REFRESH_WINDOW_MS;
  }

  function readStoredSession(storage) {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function writeStoredSession(storage, session) {
    if (!session) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  async function readJsonResponse(response) {
    return response.json().catch(() => ({}));
  }

  async function fetchPublicConfig(fetchImpl) {
    const response = await fetchImpl('/api/public-config', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const json = await readJsonResponse(response);

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || 'Admin auth is not configured.');
    }

    return {
      supabaseUrl: json.supabaseUrl,
      supabaseAnonKey: json.supabaseAnonKey,
    };
  }

  async function signInWithPassword(config, credentials, fetchImpl) {
    const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    const json = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(json?.error_description || json?.msg || 'Login failed.');
    }

    const session = normalizeSession(json);
    if (!session) {
      throw new Error('Login failed.');
    }

    return session;
  }

  async function refreshSession(config, session, fetchImpl) {
    if (!session?.refreshToken) {
      return null;
    }

    const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        refresh_token: session.refreshToken,
      }),
    });
    const json = await readJsonResponse(response);

    if (!response.ok) {
      return null;
    }

    return normalizeSession(json);
  }

  async function verifyAdminSession(fetchImpl, accessToken) {
    const response = await fetchImpl('/api/admin-session', {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = await readJsonResponse(response);

    return {
      ok: response.ok && json?.ok,
      status: response.status,
      body: json,
    };
  }

  async function getValidSession(state, forceRefresh = false) {
    let session = readStoredSession(state.storage);
    if (!session) {
      return null;
    }

    if (forceRefresh || isSessionExpiringSoon(session)) {
      const refreshed = await refreshSession(state.config, session, state.fetchImpl);
      if (!refreshed) {
        writeStoredSession(state.storage, null);
        return null;
      }

      session = refreshed;
      writeStoredSession(state.storage, session);
    }

    return session;
  }

  function createAuthorizedFetch(state) {
    return async function authorizedFetch(input, init = {}) {
      let session = await getValidSession(state);
      if (!session) {
        throw new Error('Authentication required.');
      }

      const run = async (token) => {
        const headers = new Headers(init.headers || {});
        headers.set('Authorization', `Bearer ${token}`);
        return state.fetchImpl(input, {
          ...init,
          headers,
        });
      };

      let response = await run(session.accessToken);
      if (response.status !== 401) {
        return response;
      }

      session = await getValidSession(state, true);
      if (!session) {
        throw new Error('Authentication required.');
      }

      response = await run(session.accessToken);
      if (response.status === 401 || response.status === 403) {
        writeStoredSession(state.storage, null);
      }

      return response;
    };
  }

  function setText(node, value) {
    if (node) {
      node.textContent = value || '';
    }
  }

  function setBusy(form, isBusy) {
    if (!form) {
      return;
    }

    form.querySelectorAll('input, button').forEach((field) => {
      field.disabled = Boolean(isBusy);
    });
  }

  function dispatchReady(document, detail) {
    document.dispatchEvent(new root.CustomEvent('admin-auth:ready', {
      detail,
    }));
  }

  function init({ document, fetchImpl, locationObject }) {
    if (!requiresAdminAuth(document)) {
      return;
    }

    const storage = getStorage();
    const authCard = document.getElementById('adminAuthCard');
    const authForm = document.getElementById('adminAuthForm');
    const emailInput = document.getElementById('adminEmail');
    const passwordInput = document.getElementById('adminPassword');
    const authMessage = document.getElementById('adminAuthMessage');
    const protectedContent = document.getElementById('adminProtectedContent');
    const signOutButton = document.getElementById('adminSignOutBtn');
    const authStatus = document.getElementById('adminAuthStatus');

    const state = {
      config: null,
      fetchImpl,
      storage,
    };

    function showLogin(message) {
      authCard?.classList.remove('hidden');
      protectedContent?.classList.add('hidden');
      signOutButton?.classList.add('hidden');
      authStatus?.classList.add('hidden');
      setText(authMessage, message || '管理者メールアドレスでログインしてください。');
    }

    function showProtected(user) {
      authCard?.classList.add('hidden');
      protectedContent?.classList.remove('hidden');
      signOutButton?.classList.remove('hidden');
      authStatus?.classList.remove('hidden');
      setText(authStatus, user?.email || '');
    }

    async function finishLogin(session) {
      writeStoredSession(storage, session);
      const verification = await verifyAdminSession(fetchImpl, session.accessToken);
      if (!verification.ok) {
        writeStoredSession(storage, null);
        throw new Error(verification.body?.error || 'Admin access denied.');
      }

      const authorizedFetch = createAuthorizedFetch(state);
      showProtected(verification.body.user);
      dispatchReady(document, {
        fetchImpl: authorizedFetch,
        user: verification.body.user,
      });
    }

    authForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.config) {
        showLogin('Admin auth is not configured.');
        return;
      }

      const email = String(emailInput?.value || '').trim();
      const password = String(passwordInput?.value || '');
      if (!email || !password) {
        showLogin('メールアドレスとパスワードを入力してください。');
        return;
      }

      setBusy(authForm, true);
      setText(authMessage, 'ログイン中...');

      try {
        const session = await signInWithPassword(state.config, { email, password }, fetchImpl);
        await finishLogin(session);
        authForm.reset();
      } catch (error) {
        showLogin(error.message || 'ログインに失敗しました。');
      } finally {
        setBusy(authForm, false);
      }
    });

    signOutButton?.addEventListener('click', () => {
      writeStoredSession(storage, null);
      showLogin('ログアウトしました。');
      if (locationObject?.reload) {
        locationObject.reload();
      }
    });

    (async () => {
      try {
        state.config = await fetchPublicConfig(fetchImpl);
      } catch (error) {
        showLogin(error.message || 'Admin auth is not configured.');
        return;
      }

      const session = await getValidSession(state);
      if (!session) {
        showLogin('');
        return;
      }

      try {
        await finishLogin(session);
      } catch (error) {
        showLogin(error.message || 'ログインしてください。');
      }
    })();
  }

  return {
    createAuthorizedFetch,
    getValidSession,
    init,
    isSessionExpiringSoon,
    normalizeSession,
    readStoredSession,
    refreshSession,
    requiresAdminAuth,
    signInWithPassword,
    verifyAdminSession,
    writeStoredSession,
  };
}));
