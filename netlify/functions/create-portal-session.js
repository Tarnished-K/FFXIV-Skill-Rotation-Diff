const { readRuntimeEnv } = require('../../lib/runtime-env');
const {
  getBillingCustomer,
  getUserIdFromJWT,
  upsertBillingCustomer,
  upsertSubscription,
} = require('../../lib/billing');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function corsHeaders(origin) {
  const headers = { ...JSON_HEADERS, Vary: 'Origin' };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(statusCode, body, origin = '') {
  return {
    statusCode,
    headers: corsHeaders(origin),
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
      || url.hostname === 'www.xiv-srd.com'
      || url.hostname === 'vermillion-crumble-a1f1aa.netlify.app'
      || url.hostname.endsWith('--vermillion-crumble-a1f1aa.netlify.app')
      || url.hostname === 'localhost'
      || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function isCustomerModeMismatch(data) {
  const message = String(data?.error?.message || '');
  return data?.error?.code === 'resource_missing'
    && message.includes('No such customer')
    && message.includes('similar object exists');
}

function getSubscriptionPeriodEnd(subscription) {
  const unixSeconds = subscription?.current_period_end
    || subscription?.items?.data?.[0]?.current_period_end
    || subscription?.items?.data?.find?.((item) => item?.current_period_end)?.current_period_end;
  return Number.isFinite(Number(unixSeconds))
    ? new Date(Number(unixSeconds) * 1000).toISOString()
    : null;
}

function stripeSearchLiteral(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function createPortalSession(stripeSecretKey, customerId, returnUrl) {
  const params = new URLSearchParams();
  params.set('customer', customerId);
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
  return { res, data };
}

async function recoverCustomerFromLiveSubscription(stripeSecretKey, userId) {
  const params = new URLSearchParams();
  params.set('query', `metadata['user_id']:'${stripeSearchLiteral(userId)}'`);
  params.set('limit', '10');
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const now = Date.now();
  const subscription = data?.data
    ?.filter((item) => item?.metadata?.user_id === userId)
    ?.filter((item) => ['active', 'trialing'].includes(item?.status))
    ?.find((item) => {
      const periodEnd = getSubscriptionPeriodEnd(item);
      return periodEnd && Date.parse(periodEnd) >= now;
    });
  if (!subscription?.customer) return null;

  const stripeCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);
  if (!stripeCustomerId || !currentPeriodEnd) return null;

  await upsertBillingCustomer({ userId, stripeCustomerId });
  await upsertSubscription({
    id: subscription.id,
    user_id: userId,
    stripe_customer_id: stripeCustomerId,
    status: subscription.status,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  });
  return stripeCustomerId;
}

exports.handler = async (event) => {
  const origin = getOrigin(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' }, origin);
  }

  const stripeSecretKey = readRuntimeEnv('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    return json(503, { ok: false, error: 'Customer Portal is not configured.' }, origin);
  }

  const jwt = extractJWT(event);
  const userId = jwt ? await getUserIdFromJWT(jwt) : null;
  if (!userId) {
    return json(401, { ok: false, error: 'Login required.' }, origin);
  }

  const customer = await getBillingCustomer(userId);
  if (!customer?.stripe_customer_id) {
    return json(404, { ok: false, error: 'No supporter registration was found for this account.' }, origin);
  }

  if (!isAllowedOrigin(origin)) {
    return json(400, { ok: false, error: 'Origin is not allowed for the portal.' }, origin);
  }

  const returnUrl = readRuntimeEnv('STRIPE_PORTAL_RETURN_URL') || `${origin}/premium.html`;

  let { res, data } = await createPortalSession(stripeSecretKey, customer.stripe_customer_id, returnUrl);
  if (!res.ok || !data?.url) {
    if (isCustomerModeMismatch(data)) {
      const recoveredCustomerId = await recoverCustomerFromLiveSubscription(stripeSecretKey, userId);
      if (recoveredCustomerId) {
        ({ res, data } = await createPortalSession(stripeSecretKey, recoveredCustomerId, returnUrl));
        if (res.ok && data?.url) {
          return json(200, { ok: true, url: data.url }, origin);
        }
      }
      return json(409, {
        ok: false,
        error: 'Saved supporter billing data is not available in the current billing mode. Please register again.',
      }, origin);
    }
    return json(res.status || 502, {
      ok: false,
      error: 'Failed to create Customer Portal session.',
    }, origin);
  }

  return json(200, { ok: true, url: data.url }, origin);
};
