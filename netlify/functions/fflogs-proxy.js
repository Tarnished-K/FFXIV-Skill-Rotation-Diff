const { graphqlRequest } = require('../../lib/fflogs-client');
const { inferStatusCode, normalizeErrorMessage } = require('../../lib/fflogs-proxy-utils');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: JSON_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Request body must be valid JSON.' });
  }

  if (!payload.query || typeof payload.query !== 'string') {
    return json(400, { error: 'query is required.' });
  }

  try {
    const data = await graphqlRequest(payload.query, payload.variables || {});
    return json(200, { data });
  } catch (error) {
    const message = normalizeErrorMessage(error?.message);
    return json(inferStatusCode(message), { error: message });
  }
};
