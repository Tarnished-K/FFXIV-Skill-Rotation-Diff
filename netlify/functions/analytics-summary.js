const { clamp, summarizeEvents } = require('../../lib/analytics-utils');
const { fetchRecentAppEvents } = require('../../lib/db');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    return json(405, { error: 'Method Not Allowed' });
  }

  const days = clamp(Number(event.queryStringParameters?.days) || 14, 3, 30);
  const limit = clamp(Number(event.queryStringParameters?.limit) || 1000, 100, 2000);

  try {
    const result = await fetchRecentAppEvents(limit);
    if (!result.enabled) {
      return json(503, {
        ok: false,
        error: 'Analytics storage is not configured in this environment.',
      });
    }
    return json(200, {
      ok: true,
      analytics: summarizeEvents(result.rows, days),
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error?.message || 'Failed to summarize analytics.',
    });
  }
};
