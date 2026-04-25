const { getUsageStatus, getUserIdFromJWT } = require('../../lib/billing');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

function extractJWT(event) {
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function extractAnonKey(event) {
  const cookieHeader = (event.headers && event.headers.cookie) || '';
  const match = cookieHeader.match(/(?:^|;\s*)anon_key=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  const status = await getUsageStatus({
    userId: userId || null,
    anonKey: userId ? null : extractAnonKey(event),
  });

  return json(200, {
    ok: true,
    isLoggedIn: Boolean(userId),
    isPremium: status.isPremium,
    remaining: status.remaining,
    count: status.count,
    dailyLimit: status.dailyLimit,
  });
};
