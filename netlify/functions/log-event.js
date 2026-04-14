const { writeAppEvent } = require('../../lib/db');

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

  const eventType = String(payload.eventType || '').trim();
  if (!eventType) {
    return json(400, { error: 'eventType is required.' });
  }

  try {
    const result = await writeAppEvent({
      eventType,
      pathname: String(payload.pathname || ''),
      details: payload.details && typeof payload.details === 'object' ? payload.details : {},
    });
    return json(202, result.enabled ? { ok: true } : { ok: true, skipped: true });
  } catch (error) {
    return json(500, { error: error?.message || 'Failed to store event.' });
  }
};
