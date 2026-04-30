const crypto = require('crypto');
const { readRuntimeEnv } = require('../../lib/runtime-env');
const {
  getBillingCustomerByStripeCustomerId,
  markWebhookEventProcessed,
  recordWebhookEvent,
  upsertBillingCustomer,
  upsertSubscription,
} = require('../../lib/billing');

function verifyStripeSignature({ rawBody, signature, secret }) {
  const parts = {};
  for (const part of signature.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    parts[part.slice(0, idx)] = part.slice(idx + 1);
  }
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;
  const payload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  try {
    const a = Buffer.from(hmac, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getRawBody(event) {
  if (!event.body) return '';
  return event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
}

async function fetchStripeSubscription(subscriptionId) {
  const stripeSecretKey = readRuntimeEnv('STRIPE_SECRET_KEY');
  if (!stripeSecretKey || !subscriptionId) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` },
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

async function resolveUserIdFromCustomer(customerId) {
  const customer = await getBillingCustomerByStripeCustomerId(customerId);
  return customer?.user_id || null;
}

async function upsertStripeSubscriptionObject(obj, fallbackUserId) {
  if (!obj?.id) return;
  const userId = obj.metadata?.user_id || fallbackUserId || await resolveUserIdFromCustomer(String(obj.customer || ''));
  if (!userId) return;
  await upsertSubscription({
    id: obj.id,
    user_id: userId,
    stripe_customer_id: String(obj.customer),
    status: obj.status,
    current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
    cancel_at_period_end: obj.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const webhookSecret = readRuntimeEnv('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return { statusCode: 503, body: 'Webhook not configured' };
  }
  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || '';
  if (!signature) {
    return { statusCode: 400, body: 'Missing stripe-signature' };
  }
  const rawBody = getRawBody(event);
  if (!verifyStripeSignature({ rawBody, signature, secret: webhookSecret })) {
    return { statusCode: 400, body: 'Invalid signature' };
  }
  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  const { isDuplicate } = await recordWebhookEvent({
    stripeEventId: stripeEvent.id,
    type: stripeEvent.type,
    payload: stripeEvent,
  });
  if (isDuplicate) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
  }
  const obj = stripeEvent.data && stripeEvent.data.object;
  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const userId = obj && obj.metadata && obj.metadata.user_id;
      const customerId = obj && obj.customer;
      if (userId && customerId) {
        await upsertBillingCustomer({ userId, stripeCustomerId: customerId });
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await upsertStripeSubscriptionObject(obj);
      break;
    }
    case 'customer.subscription.deleted': {
      await upsertStripeSubscriptionObject({ ...obj, status: 'canceled', cancel_at_period_end: false });
      break;
    }
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      const subscriptionId = obj && (typeof obj.subscription === 'string'
        ? obj.subscription
        : obj.subscription?.id);
      const subscription = await fetchStripeSubscription(subscriptionId);
      const fallbackUserId = obj?.subscription_details?.metadata?.user_id
        || obj?.metadata?.user_id
        || await resolveUserIdFromCustomer(String(obj?.customer || ''));
      if (subscription) {
        await upsertStripeSubscriptionObject(subscription, fallbackUserId);
      }
      break;
    }
    default:
      break;
  }
  await markWebhookEventProcessed(stripeEvent.id);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
