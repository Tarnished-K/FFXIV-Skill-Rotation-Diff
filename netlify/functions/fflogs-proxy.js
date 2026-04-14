const { graphqlRequest } = require('../../lib/fflogs-client');

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

function normalizeErrorMessage(rawMessage) {
  const message = String(rawMessage || 'Unknown FF Logs proxy error.');
  if (/Missing required environment variable/i.test(message)) {
    return 'サーバー設定が未完了です。FFLOGS_CLIENT_ID と FFLOGS_CLIENT_SECRET を設定してください。';
  }
  if (/authoriz|permission|private|forbidden|public/i.test(message)) {
    return '公開ログのみ対応です。FF Logs 側で公開されているレポートを指定してください。';
  }
  return message;
}

function inferStatusCode(message) {
  if (message.includes('公開ログのみ対応')) return 403;
  if (message.includes('サーバー設定が未完了')) return 500;
  return 502;
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
