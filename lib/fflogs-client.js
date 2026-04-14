const FFLOGS_TOKEN_URL = 'https://www.fflogs.com/oauth/token';
const FFLOGS_GRAPHQL_URL = 'https://www.fflogs.com/api/v2/client';

let cachedAccessToken = '';
let cachedExpiresAt = 0;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < cachedExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: getRequiredEnv('FFLOGS_CLIENT_ID'),
    client_secret: getRequiredEnv('FFLOGS_CLIENT_SECRET'),
  });

  const response = await fetch(FFLOGS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`FF Logs token request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const json = await response.json();
  if (!json.access_token) {
    throw new Error('FF Logs access token was not returned.');
  }

  cachedAccessToken = json.access_token;
  cachedExpiresAt = now + Math.max(0, Number(json.expires_in || 0)) * 1000;
  return cachedAccessToken;
}

async function graphqlRequest(query, variables = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('GraphQL query is required.');
  }

  async function sendRequest(accessToken) {
    return fetch(FFLOGS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  }

  let response = await sendRequest(await fetchAccessToken());
  if (response.status === 401) {
    response = await sendRequest(await fetchAccessToken(true));
  }

  const json = await response.json();
  if (!response.ok) {
    const detail = json?.errors?.[0]?.message || json?.error || `status ${response.status}`;
    throw new Error(detail);
  }
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'FF Logs GraphQL error.');
  }

  return json.data;
}

module.exports = {
  graphqlRequest,
};
