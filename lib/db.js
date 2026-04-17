const { readRuntimeEnv } = require('./runtime-env');

function getSupabaseConfig() {
  const url = readRuntimeEnv('SUPABASE_URL');
  const serviceRoleKey = readRuntimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    return null;
  }
  return {
    url: url.replace(/\/+$/, ''),
    serviceRoleKey,
  };
}

function getSupabaseHeaders(config, extraHeaders = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extraHeaders,
  };
}

async function writeAppEvent({ eventType, pathname = '', details = {} }) {
  const config = getSupabaseConfig();
  if (!config) {
    return { enabled: false };
  }

  const response = await fetch(`${config.url}/rest/v1/app_events`, {
    method: 'POST',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify([
      {
        event_type: eventType,
        pathname,
        details,
      },
    ]),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  return { enabled: true };
}

async function fetchRecentAppEvents(limit = 500) {
  const config = getSupabaseConfig();
  if (!config) {
    return { enabled: false, rows: [] };
  }

  const size = Math.max(1, Math.min(Number(limit) || 500, 2000));
  const url = new URL(`${config.url}/rest/v1/app_events`);
  url.searchParams.set('select', 'event_type,pathname,details,created_at');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(size));

  const response = await fetch(url, {
    method: 'GET',
    headers: getSupabaseHeaders(config, {
      Accept: 'application/json',
      Prefer: 'count=exact',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase select failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  return { enabled: true, rows: Array.isArray(rows) ? rows : [] };
}

module.exports = {
  fetchRecentAppEvents,
  writeAppEvent,
};
