const { getUserIdFromJWT, isUserPremium, getSupabaseConfig, serviceHeaders } = require('../../lib/billing');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

function parseBody(body) {
  try {
    return { ok: true, payload: JSON.parse(body || '{}') };
  } catch {
    return { ok: false };
  }
}

function getIdParam(event) {
  return event.queryStringParameters?.id || new URLSearchParams(event.rawQuery || '').get('id');
}

async function authorize(event) {
  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  if (!userId) return { ok: false, response: json(401, { ok: false, error: 'Login required.' }) };
  const premium = await isUserPremium(userId);
  if (!premium) return { ok: false, response: json(403, { ok: false, error: 'Supporter plan required.' }) };
  const config = getSupabaseConfig();
  if (!config) return { ok: false, response: json(503, { ok: false, error: 'Bookmarks are not configured.' }) };
  return { ok: true, userId, config };
}

async function countBookmarks(config, userId) {
  const url = new URL(`${config.url}/rest/v1/comparison_bookmarks`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('user_id', `eq.${userId}`);
  const res = await fetch(url, {
    headers: serviceHeaders(config, {
      Accept: 'application/json',
      Prefer: 'count=exact',
    }),
  });
  if (!res.ok) return 0;
  const range = res.headers.get('content-range') || '';
  const match = range.match(/\/(\d+)$/);
  if (match) return Number(match[1]);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

async function listBookmarks(config, userId) {
  const url = new URL(`${config.url}/rest/v1/comparison_bookmarks`);
  url.searchParams.set('select', 'id,title,data,created_at,updated_at');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('order', 'updated_at.desc');
  const res = await fetch(url, {
    headers: serviceHeaders(config, { Accept: 'application/json' }),
  });
  if (!res.ok) return json(res.status, { ok: false, error: 'Failed to load bookmarks.' });
  const rows = await res.json();
  return json(200, { ok: true, bookmarks: Array.isArray(rows) ? rows : [] });
}

async function createBookmark(event, config, userId) {
  const parsed = parseBody(event.body);
  if (!parsed.ok) return json(400, { ok: false, error: 'Invalid JSON.' });
  const payload = parsed.payload;
  const count = await countBookmarks(config, userId);
  if (count >= 100) {
    return json(409, { ok: false, error: 'Bookmark limit reached.', limit: 100 });
  }
  const title = String(payload.title || '').trim().slice(0, 120) || '比較ブックマーク';
  const data = payload.data;
  if (!data || typeof data !== 'object') {
    return json(400, { ok: false, error: 'Bookmark data is required.' });
  }
  const res = await fetch(`${config.url}/rest/v1/comparison_bookmarks`, {
    method: 'POST',
    headers: serviceHeaders(config, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({ user_id: userId, title, data }),
  });
  const rows = await res.json().catch(() => []);
  if (!res.ok) return json(res.status, { ok: false, error: 'Failed to save bookmark.' });
  return json(200, { ok: true, bookmark: Array.isArray(rows) ? rows[0] : null });
}

async function deleteBookmark(event, config, userId) {
  const id = getIdParam(event);
  if (!id || !/^\d+$/.test(id)) return json(400, { ok: false, error: 'Bookmark id is required.' });
  const url = new URL(`${config.url}/rest/v1/comparison_bookmarks`);
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('user_id', `eq.${userId}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: serviceHeaders(config, { Prefer: 'return=minimal' }),
  });
  if (!res.ok) return json(res.status, { ok: false, error: 'Failed to delete bookmark.' });
  return json(200, { ok: true });
}

async function updateBookmark(event, config, userId) {
  const id = getIdParam(event);
  if (!id || !/^\d+$/.test(id)) return json(400, { ok: false, error: 'Bookmark id is required.' });
  const parsed = parseBody(event.body);
  if (!parsed.ok) return json(400, { ok: false, error: 'Invalid JSON.' });
  const payload = parsed.payload;
  const title = String(payload.title || '').trim().slice(0, 120);
  if (!title) return json(400, { ok: false, error: 'Bookmark title is required.' });
  const url = new URL(`${config.url}/rest/v1/comparison_bookmarks`);
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('user_id', `eq.${userId}`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: serviceHeaders(config, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({ title }),
  });
  const rows = await res.json().catch(() => []);
  if (!res.ok) return json(res.status, { ok: false, error: 'Failed to update bookmark.' });
  return json(200, { ok: true, bookmark: Array.isArray(rows) ? rows[0] : null });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }
  const auth = await authorize(event);
  if (!auth.ok) return auth.response;

  if (event.httpMethod === 'GET') return listBookmarks(auth.config, auth.userId);
  if (event.httpMethod === 'POST') return createBookmark(event, auth.config, auth.userId);
  if (event.httpMethod === 'PATCH') return updateBookmark(event, auth.config, auth.userId);
  if (event.httpMethod === 'DELETE') return deleteBookmark(event, auth.config, auth.userId);
  return json(405, { ok: false, error: 'Method Not Allowed' });
};
