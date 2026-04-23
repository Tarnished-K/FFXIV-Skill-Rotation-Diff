const crypto = require('crypto');
const { readRuntimeEnv } = require('../../lib/runtime-env');
const { recordWebhookEvent, upsertBillingCustomer, upsertSubscription } = require('../../lib/billing');

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
  const rawBody = event.body || '';
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
      const userId = obj && obj.metadata && obj.metadata.user_id;
      if (userId && obj && obj.id) {
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
      break;
    }
    case 'customer.subscription.deleted': {
      const userId = obj && obj.metadata && obj.metadata.user_id;
      if (userId && obj && obj.id) {
        await upsertSubscription({
          id: obj.id,
          user_id: userId,
          stripe_customer_id: String(obj.customer),
          status: 'canceled',
          current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        });
      }
      break;
    }
    default:
      break;
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
