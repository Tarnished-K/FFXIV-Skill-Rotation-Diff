const { readRuntimeEnv } = require('./runtime-env');

const ANON_DAILY_LIMIT = 5;
const FREE_USER_DAILY_LIMIT = 15;

function getSupabaseConfig() {
  const url = readRuntimeEnv('SUPABASE_URL');
  const serviceRoleKey = readRuntimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ''), serviceRoleKey };
}

function serviceHeaders(config, extra = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extra,
  };
}

async function getUserIdFromJWT(jwt) {
  if (!jwt) return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  const anonKey = readRuntimeEnv('SUPABASE_ANON_KEY');
  try {
    const res = await fetch(`${config.url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}

function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function isUserPremium(userId) {
  if (!userId) return false;
  const config = getSupabaseConfig();
  if (!config) return false;
  const now = new Date().toISOString();
  const url = new URL(`${config.url}/rest/v1/billing_subscriptions`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('status', 'in.(active,trialing)');
  url.searchParams.set('current_period_end', `gte.${now}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url, { headers: serviceHeaders(config, { Accept: 'application/json' }) });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function getBillingCustomer(userId) {
  if (!userId) return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  const url = new URL(`${config.url}/rest/v1/billing_customers`);
  url.searchParams.set('select', 'stripe_customer_id');
  url.searchParams.set('user_id', `eq.${userId}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url, { headers: serviceHeaders(config, { Accept: 'application/json' }) });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getBillingCustomerByStripeCustomerId(stripeCustomerId) {
  if (!stripeCustomerId) return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  const url = new URL(`${config.url}/rest/v1/billing_customers`);
  url.searchParams.set('select', 'user_id,stripe_customer_id');
  url.searchParams.set('stripe_customer_id', `eq.${stripeCustomerId}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url, { headers: serviceHeaders(config, { Accept: 'application/json' }) });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function checkAndIncrementUsage({ userId, anonKey }) {
  const config = getSupabaseConfig();
  const dailyLimit = userId ? FREE_USER_DAILY_LIMIT : ANON_DAILY_LIMIT;
  if (!config) return { allowed: true, count: 0, remaining: dailyLimit, isPremium: false, dailyLimit };

  if (userId) {
    const premium = await isUserPremium(userId);
    if (premium) return { allowed: true, count: 0, remaining: 9999, isPremium: true, dailyLimit: 9999 };
  }

  const date = todayJST();
  const selectUrl = new URL(`${config.url}/rest/v1/comparison_daily_usage`);
  selectUrl.searchParams.set('select', 'id,count');
  selectUrl.searchParams.set('usage_date', `eq.${date}`);
  selectUrl.searchParams.set('limit', '1');
  if (userId) {
    selectUrl.searchParams.set('user_id', `eq.${userId}`);
  } else {
    selectUrl.searchParams.set('anon_key', `eq.${anonKey}`);
  }

  const selectRes = await fetch(selectUrl, { headers: serviceHeaders(config, { Accept: 'application/json' }) });
  const rows = selectRes.ok ? await selectRes.json() : [];
  const current = Array.isArray(rows) ? rows[0] || null : null;
  const currentCount = current ? current.count : 0;

  if (currentCount >= dailyLimit) {
    return { allowed: false, count: currentCount, remaining: 0, isPremium: false, dailyLimit };
  }

  const newCount = currentCount + 1;
  const now = new Date().toISOString();

  if (current) {
    const patchUrl = new URL(`${config.url}/rest/v1/comparison_daily_usage`);
    patchUrl.searchParams.set('id', `eq.${current.id}`);
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: serviceHeaders(config, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ count: newCount, updated_at: now }),
    });
  } else {
    const body = userId
      ? { user_id: userId, usage_date: date, count: newCount }
      : { anon_key: anonKey, usage_date: date, count: newCount };
    await fetch(`${config.url}/rest/v1/comparison_daily_usage`, {
      method: 'POST',
      headers: serviceHeaders(config, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(body),
    });
  }

  return { allowed: true, count: newCount, remaining: dailyLimit - newCount, isPremium: false, dailyLimit };
}

async function getUsageStatus({ userId, anonKey }) {
  const config = getSupabaseConfig();
  const dailyLimit = userId ? FREE_USER_DAILY_LIMIT : ANON_DAILY_LIMIT;
  if (!config) return { count: 0, remaining: dailyLimit, isPremium: false, dailyLimit };

  if (userId) {
    const premium = await isUserPremium(userId);
    if (premium) return { count: 0, remaining: 9999, isPremium: true, dailyLimit: 9999 };
  }

  const date = todayJST();
  const selectUrl = new URL(`${config.url}/rest/v1/comparison_daily_usage`);
  selectUrl.searchParams.set('select', 'count');
  selectUrl.searchParams.set('usage_date', `eq.${date}`);
  selectUrl.searchParams.set('limit', '1');
  if (userId) {
    selectUrl.searchParams.set('user_id', `eq.${userId}`);
  } else if (anonKey) {
    selectUrl.searchParams.set('anon_key', `eq.${anonKey}`);
  } else {
    return { count: 0, remaining: dailyLimit, isPremium: false, dailyLimit };
  }

  const selectRes = await fetch(selectUrl, { headers: serviceHeaders(config, { Accept: 'application/json' }) });
  const rows = selectRes.ok ? await selectRes.json() : [];
  const current = Array.isArray(rows) ? rows[0] || null : null;
  const count = current ? Number(current.count || 0) : 0;
  return {
    count,
    remaining: Math.max(0, dailyLimit - count),
    isPremium: false,
    dailyLimit,
  };
}

async function upsertBillingCustomer({ userId, stripeCustomerId }) {
  const config = getSupabaseConfig();
  if (!config) return;
  await fetch(`${config.url}/rest/v1/billing_customers`, {
    method: 'POST',
    headers: serviceHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify({ user_id: userId, stripe_customer_id: stripeCustomerId }),
  });
}

async function upsertSubscription(sub) {
  const config = getSupabaseConfig();
  if (!config) return;
  await fetch(`${config.url}/rest/v1/billing_subscriptions`, {
    method: 'POST',
    headers: serviceHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify(sub),
  });
}

async function recordWebhookEvent({ stripeEventId, type, payload }) {
  const config = getSupabaseConfig();
  if (!config) return { isDuplicate: false };
  const res = await fetch(`${config.url}/rest/v1/stripe_webhook_events`, {
    method: 'POST',
    headers: serviceHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({ stripe_event_id: stripeEventId, type, payload }),
  });
  if (res.status === 409) {
    const url = new URL(`${config.url}/rest/v1/stripe_webhook_events`);
    url.searchParams.set('select', 'processed_at');
    url.searchParams.set('stripe_event_id', `eq.${stripeEventId}`);
    url.searchParams.set('limit', '1');
    const existingRes = await fetch(url, { headers: serviceHeaders(config, { Accept: 'application/json' }) });
    const rows = existingRes.ok ? await existingRes.json() : [];
    const existing = Array.isArray(rows) ? rows[0] || null : null;
    return { isDuplicate: true, processedAt: existing?.processed_at || null };
  }
  return { isDuplicate: false };
}

async function markWebhookEventProcessed(stripeEventId) {
  const config = getSupabaseConfig();
  if (!config || !stripeEventId) return;
  const url = new URL(`${config.url}/rest/v1/stripe_webhook_events`);
  url.searchParams.set('stripe_event_id', `eq.${stripeEventId}`);
  await fetch(url, {
    method: 'PATCH',
    headers: serviceHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    body: JSON.stringify({ processed_at: new Date().toISOString() }),
  });
}

module.exports = {
  getSupabaseConfig,
  serviceHeaders,
  getUserIdFromJWT,
  todayJST,
  isUserPremium,
  getBillingCustomer,
  getBillingCustomerByStripeCustomerId,
  checkAndIncrementUsage,
  getUsageStatus,
  upsertBillingCustomer,
  upsertSubscription,
  recordWebhookEvent,
  markWebhookEventProcessed,
};
