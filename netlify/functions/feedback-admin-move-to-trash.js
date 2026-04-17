const feedbackDb = require('../../lib/feedback-db');
const { authorizeAdminRequest } = require('../../lib/admin-auth');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const auth = await authorizeAdminRequest(event);
  if (!auth.ok) {
    return json(auth.statusCode, auth.body);
  }

  if (!feedbackDb.isFeedbackStorageConfigured()) {
    return json(503, { ok: false, error: 'Feedback storage is not configured.' });
  }

  const { id, reason } = JSON.parse(event.body || '{}');
  const result = await feedbackDb.moveFeedbackEntryToTrash({ id, reason });

  return json(200, {
    ok: true,
    ...result,
  });
};
