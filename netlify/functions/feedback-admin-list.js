const feedbackDb = require('../../lib/feedback-db');
const { authorizeAdminRequest } = require('../../lib/admin-auth');

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: JSON_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const auth = await authorizeAdminRequest(event);
  if (!auth.ok) {
    return json(auth.statusCode, auth.body);
  }

  if (!feedbackDb.isFeedbackStorageConfigured()) {
    return json(503, { ok: false, error: 'Feedback storage is not configured.' });
  }

  const query = event.queryStringParameters || {};
  const limit = Math.max(1, Math.min(Number(query.limit) || 20, 100));
  const offset = Math.max(0, Number(query.offset) || 0);

  const result = await feedbackDb.listFeedbackEntries({
    bucket: query.bucket || '',
    category: query.category || '',
    isRead: query.is_read || '',
    limit,
    offset,
  });

  return json(200, {
    summary: result.summary,
    items: result.items,
    pagination: result.pagination,
  });
};
