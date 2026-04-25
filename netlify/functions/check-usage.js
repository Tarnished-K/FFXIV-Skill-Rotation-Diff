const crypto = require('crypto');
const { checkAndIncrementUsage, getUserIdFromJWT } = require('../../lib/billing');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body, extraHeaders) {
  extraHeaders = extraHeaders || {};
  return {
    statusCode,
    headers: Object.assign({}, JSON_HEADERS, extraHeaders),
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
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }
  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  let anonKey = extractAnonKey(event);
  let isNewAnonKey = false;
  if (!userId && !anonKey) {
    anonKey = crypto.randomUUID();
    isNewAnonKey = true;
  }
  const result = await checkAndIncrementUsage({
    userId: userId || null,
    anonKey: userId ? null : anonKey,
  });
  const extraHeaders = {};
  if (isNewAnonKey && anonKey) {
    extraHeaders['Set-Cookie'] =
      'anon_key=' + anonKey + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000';
  }
  if (!result.allowed) {
    return json(429, { ok: false, error: 'Daily limit reached', count: result.count, remaining: 0, dailyLimit: result.dailyLimit }, extraHeaders);
  }
  return json(200, {
    ok: true,
    count: result.count,
    remaining: result.remaining,
    isPremium: result.isPremium,
    dailyLimit: result.dailyLimit,
  }, extraHeaders);
};
