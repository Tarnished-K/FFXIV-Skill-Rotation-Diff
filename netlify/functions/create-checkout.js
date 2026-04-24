const { readRuntimeEnv } = require('../../lib/runtime-env');
const { getUserIdFromJWT } = require('../../lib/billing');

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

function extractJWT(event) {
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function getOrigin(event) {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin;
  if (origin) return String(origin).replace(/\/+$/, '');
  const host = headers.host || headers.Host;
  const proto = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https';
  return host ? `${proto}://${host}` : 'https://xiv-srd.com';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const stripeSecretKey = readRuntimeEnv('STRIPE_SECRET_KEY');
  const priceId = readRuntimeEnv('STRIPE_PRICE_ID');
  if (!stripeSecretKey || !priceId) {
    return json(503, { ok: false, error: 'Checkout is not configured.' });
  }

  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  if (!userId) {
    return json(401, { ok: false, error: 'Login required.' });
  }

  const origin = getOrigin(event);
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('metadata[user_id]', userId);
  params.set('subscription_data[metadata][user_id]', userId);
  params.set('success_url', `${origin}/?payment=success`);
  params.set('cancel_url', `${origin}/premium.html`);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.url) {
    return json(res.status || 502, {
      ok: false,
      error: data?.error?.message || 'Failed to create checkout session.',
    });
  }

  return json(200, { ok: true, url: data.url });
};
