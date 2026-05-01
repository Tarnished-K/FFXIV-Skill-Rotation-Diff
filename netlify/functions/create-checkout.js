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

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
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

function checkoutUrl(name, origin, fallbackPath) {
  const configured = readRuntimeEnv(name);
  if (configured) return configured;
  return `${origin}${fallbackPath}`;
}

function isCustomerModeMismatch(data) {
  const message = String(data?.error?.message || '');
  return data?.error?.code === 'resource_missing'
    && message.includes('No such customer')
    && message.includes('similar object exists');
}

async function createCheckoutSession(stripeSecretKey, params) {
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => null);
  return { res, data };
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
  const paymentsEnabled = isTruthy(readRuntimeEnv('SUPPORTER_PAYMENTS_ENABLED'));
  if (!paymentsEnabled) {
    return json(503, { ok: false, error: 'Supporter registration is not enabled yet.' });
  }
  if (!stripeSecretKey || !priceId) {
    return json(503, { ok: false, error: 'Checkout is not configured.' });
  }

  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  if (!userId) {
    return json(401, { ok: false, error: 'Login required.' });
  }

  const origin = getOrigin(event);
  if (!isAllowedOrigin(origin)) {
    return json(400, { ok: false, error: 'Origin is not allowed for checkout.' });
  }
  const customer = await getBillingCustomer(userId);
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  if (customer?.stripe_customer_id) {
    params.set('customer', customer.stripe_customer_id);
  }
  params.set('metadata[user_id]', userId);
  params.set('subscription_data[metadata][user_id]', userId);
  params.set('success_url', checkoutUrl('STRIPE_SUCCESS_URL', origin, '/?payment=success'));
  params.set('cancel_url', checkoutUrl('STRIPE_CANCEL_URL', origin, '/premium.html?checkout=cancel'));

  let { res, data } = await createCheckoutSession(stripeSecretKey, params);
  if (!res.ok && customer?.stripe_customer_id && isCustomerModeMismatch(data)) {
    params.delete('customer');
    ({ res, data } = await createCheckoutSession(stripeSecretKey, params));
  }

  if (!res.ok || !data || !data.url) {
    return json(res.status || 502, {
      ok: false,
      error: data?.error?.message || 'Failed to create checkout session.',
    });
  }

  return json(200, { ok: true, url: data.url });
};
