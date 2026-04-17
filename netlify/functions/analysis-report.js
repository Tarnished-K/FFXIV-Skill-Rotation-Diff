const { authorizeAdminRequest } = require('../../lib/admin-auth');
const { readRuntimeEnv } = require('../../lib/runtime-env');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

async function fetchLatestReport(supabaseUrl, serviceKey) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/analysis_reports?order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return rows[0] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const auth = await authorizeAdminRequest(event);
  if (!auth.ok) return json(auth.statusCode, auth.body);

  const supabaseUrl = readRuntimeEnv('SUPABASE_URL');
  const serviceKey = readRuntimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(503, { ok: false, error: 'Storage not configured.' });
  }

  const report = await fetchLatestReport(supabaseUrl.replace(/\/+$/, ''), serviceKey);
  return json(200, { ok: true, report });
};
