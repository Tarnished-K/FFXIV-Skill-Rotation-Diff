const { graphqlRequest } = require('../../lib/fflogs-client');
const { inferStatusCode, normalizeErrorMessage } = require('../../lib/fflogs-proxy-utils');

const ALLOWED_ORIGINS = [
  'https://xiv-srd.com',
  'https://www.xiv-srd.com',
];

const MAX_QUERY_LENGTH = 4000;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+--vermillion-crumble-a1f1aa\.netlify\.app$/.test(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

function makeHeaders(origin) {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(statusCode, body, origin) {
  return {
    statusCode,
    headers: makeHeaders(origin),
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: makeHeaders(origin), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return json(403, { error: 'Forbidden' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Request body must be valid JSON.' }, origin);
  }

  if (!payload.query || typeof payload.query !== 'string') {
    return json(400, { error: 'query is required.' }, origin);
  }

  if (payload.query.length > MAX_QUERY_LENGTH) {
    return json(400, { error: 'Query too large.' }, origin);
  }

  try {
    const data = await graphqlRequest(payload.query, payload.variables || {});
    return json(200, { data }, origin);
  } catch (error) {
    const message = normalizeErrorMessage(error?.message);
    return json(inferStatusCode(message), { error: message }, origin);
  }
};
