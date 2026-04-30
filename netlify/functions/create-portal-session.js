const { readRuntimeEnv } = require('../../lib/runtime-env');
const { getBillingCustomer, getUserIdFromJWT } = require('../../lib/billing');

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

function isAllowedOrigin(origin) {
  const configured = readRuntimeEnv('SUPPORTER_ALLOWED_ORIGINS')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (configured.length) return configured.includes(origin);
  try {
    const url = new URL(origin);
    return url.hostname === 'xiv-srd.com'
      || url.hostname.endsWith('.netlify.app')
      || url.hostname === 'localhost'
      || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const stripeSecretKey = readRuntimeEnv('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    return json(503, { ok: false, error: 'Customer Portal is not configured.' });
  }

  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  if (!userId) {
    return json(401, { ok: false, error: 'Login required.' });
  }

  const customer = await getBillingCustomer(userId);
  if (!customer?.stripe_customer_id) {
    return json(404, { ok: false, error: 'No supporter registration was found for this account.' });
  }

  const origin = getOrigin(event);
  if (!isAllowedOrigin(origin)) {
    return json(400, { ok: false, error: 'Origin is not allowed for the portal.' });
  }

  const returnUrl = readRuntimeEnv('STRIPE_PORTAL_RETURN_URL') || `${origin}/premium.html`;
  const params = new URLSearchParams();
  params.set('customer', customer.stripe_customer_id);
  params.set('return_url', returnUrl);

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    return json(res.status || 502, {
      ok: false,
      error: data?.error?.message || 'Failed to create Customer Portal session.',
    });
  }

  return json(200, { ok: true, url: data.url });
};
