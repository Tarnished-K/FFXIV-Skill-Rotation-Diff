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

  return json(200, {
    ok: true,
    user: {
      id: auth.user.id,
      email: auth.user.email,
    },
  });
};
