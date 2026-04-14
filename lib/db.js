function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return {
    url: url.replace(/\/+$/, ''),
    serviceRoleKey,
  };
}

async function writeAppEvent({ eventType, pathname = '', details = {} }) {
  const config = getSupabaseConfig();
  if (!config) {
    return { enabled: false };
  }

  const response = await fetch(`${config.url}/rest/v1/app_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Prefer: 'return=minimal',
    },
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

module.exports = {
  writeAppEvent,
};
