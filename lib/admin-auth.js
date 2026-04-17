const { readRuntimeEnv } = require('./runtime-env');

function parseAdminEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAdminAuthConfig() {
  const url = readRuntimeEnv('SUPABASE_URL');
  const anonKey = readRuntimeEnv('SUPABASE_ANON_KEY');
  const adminEmails = parseAdminEmails(readRuntimeEnv('ADMIN_EMAILS'));

  if (!url || !anonKey || adminEmails.length === 0) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ''),
    anonKey,
    adminEmails,
  };
}

function getBearerToken(headers = {}) {
  const entry = Object.entries(headers || {}).find(([name]) => String(name).toLowerCase() === 'authorization');
  const rawValue = entry ? entry[1] : '';
  const match = /^Bearer\s+(.+)$/i.exec(String(rawValue || '').trim());
  return match ? match[1].trim() : '';
}

function isAllowedAdminUser(user, config) {
  const email = String(user?.email || '').trim().toLowerCase();
  return Boolean(email) && Array.isArray(config?.adminEmails) && config.adminEmails.includes(email);
}

async function fetchSupabaseUser(token, config, fetchImpl = fetch) {
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    user: payload && !payload.error ? payload : null,
  };
}

async function authorizeAdminRequest(event, fetchImpl = fetch) {
  const config = getAdminAuthConfig();
  if (!config) {
    return {
      ok: false,
      statusCode: 503,
      body: {
        ok: false,
        error: 'Admin auth is not configured.',
      },
    };
  }

  const token = getBearerToken(event?.headers);
  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      body: {
        ok: false,
        error: 'Authentication required.',
      },
    };
  }

  const result = await fetchSupabaseUser(token, config, fetchImpl);
  if (!result.ok || !result.user) {
    return {
      ok: false,
      statusCode: 401,
      body: {
        ok: false,
        error: 'Authentication required.',
      },
    };
  }

  if (!isAllowedAdminUser(result.user, config)) {
    return {
      ok: false,
      statusCode: 403,
      body: {
        ok: false,
        error: 'Admin access denied.',
      },
    };
  }

  return {
    ok: true,
    config,
    user: result.user,
  };
}

function getPublicAdminAuthConfig() {
  const config = getAdminAuthConfig();
  if (!config) {
    return null;
  }

  return {
    supabaseUrl: config.url,
    supabaseAnonKey: config.anonKey,
  };
}

module.exports = {
  authorizeAdminRequest,
  fetchSupabaseUser,
  getAdminAuthConfig,
  getBearerToken,
  getPublicAdminAuthConfig,
  isAllowedAdminUser,
  parseAdminEmails,
};
