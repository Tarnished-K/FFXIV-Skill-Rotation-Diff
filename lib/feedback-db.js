const crypto = require('crypto');
const {
  buildFeedbackSummary,
  groupFeedbackItems,
} = require('./feedback-list-utils');
const { readRuntimeEnv } = require('./runtime-env');

function getSupabaseConfig() {
  const url = readRuntimeEnv('SUPABASE_URL');
  const serviceRoleKey = readRuntimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ''),
    serviceRoleKey,
  };
}

function getSupabaseHeaders(config, extraHeaders = {}) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extraHeaders,
  };
}

function isFeedbackStorageConfigured() {
  return Boolean(getSupabaseConfig());
}

function hashIpAddress(ip = '') {
  const normalized = String(ip || '').trim();
  return normalized
    ? crypto.createHash('sha256').update(normalized).digest('hex')
    : '';
}

async function cleanupRateLimitWindows(fetchImpl, config, nowIso) {
  const url = new URL(`${config.url}/rest/v1/feedback_rate_limits`);
  url.searchParams.set('window_started_at', `lt.${new Date(Date.parse(nowIso) - (10 * 60 * 1000)).toISOString()}`);
  return fetchImpl(url, {
    method: 'DELETE',
    headers: getSupabaseHeaders(config, { Prefer: 'return=minimal' }),
  });
}

async function callFeedbackRateLimitRpc(fetchImpl, config, { ipHash, windowStartedAt, now }) {
  const response = await fetchImpl(`${config.url}/rest/v1/rpc/check_and_increment_feedback_rate_limit`, {
    method: 'POST',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify({
      p_ip_hash: ipHash,
      p_window_started_at: windowStartedAt,
      p_now: now,
      p_limit: 5,
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row) return null;
  return {
    enabled: true,
    allowed: Boolean(row.allowed),
    requestCount: Number(row.request_count || 0),
    windowStartedAt,
    ipHash,
  };
}

async function checkAndIncrementFeedbackRateLimit({
  fetchImpl = fetch,
  ip,
  ipHash = hashIpAddress(ip),
  now = new Date().toISOString(),
} = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return { enabled: false, allowed: true, requestCount: 0 };
  }

  const windowMs = 10 * 60 * 1000;
  const startedMs = Math.floor(Date.parse(now) / windowMs) * windowMs;
  const windowStartedAt = new Date(startedMs).toISOString();

  await cleanupRateLimitWindows(fetchImpl, config, now);
  const rpcResult = await callFeedbackRateLimitRpc(fetchImpl, config, { ipHash, windowStartedAt, now });
  if (rpcResult) return rpcResult;

  const selectUrl = new URL(`${config.url}/rest/v1/feedback_rate_limits`);
  selectUrl.searchParams.set('select', 'request_count');
  selectUrl.searchParams.set('ip_hash', `eq.${ipHash}`);
  selectUrl.searchParams.set('window_started_at', `eq.${windowStartedAt}`);

  const selectResponse = await fetchImpl(selectUrl, {
    method: 'GET',
    headers: getSupabaseHeaders(config, {
      Accept: 'application/json',
      Prefer: 'count=exact',
    }),
  });

  if (!selectResponse.ok) {
    const detail = await selectResponse.text();
    throw new Error(`Feedback rate limit select failed (${selectResponse.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await selectResponse.json();
  const currentCount = Number(rows[0]?.request_count || 0);
  if (currentCount >= 5) {
    return { enabled: true, allowed: false, requestCount: currentCount, windowStartedAt, ipHash };
  }

  const upsertResponse = await fetchImpl(`${config.url}/rest/v1/feedback_rate_limits`, {
    method: 'POST',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify([{
      ip_hash: ipHash,
      window_started_at: windowStartedAt,
      request_count: currentCount + 1,
      updated_at: now,
    }]),
  });

  if (!upsertResponse.ok) {
    const detail = await upsertResponse.text();
    throw new Error(`Feedback rate limit upsert failed (${upsertResponse.status}): ${detail.slice(0, 200)}`);
  }

  return {
    enabled: true,
    allowed: true,
    requestCount: currentCount + 1,
    windowStartedAt,
    ipHash,
  };
}

async function createFeedbackEntry({
  fetchImpl = fetch,
  category,
  subject,
  body,
  bucket,
  aiReason = '',
  moderationProvider = '',
  moderationModel = '',
  ipHash = '',
} = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return { enabled: false };
  }

  const response = await fetchImpl(`${config.url}/rest/v1/feedback_entries`, {
    method: 'POST',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify([{
      category,
      subject,
      body,
      bucket,
      ai_reason: aiReason,
      moderation_provider: moderationProvider,
      moderation_model: moderationModel,
      ip_hash: ipHash,
    }]),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Feedback insert failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  return {
    enabled: true,
    row: Array.isArray(rows) ? rows[0] || null : null,
  };
}

function mapFeedbackRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    body: row.body,
    bucket: row.bucket,
    ai_reason: row.ai_reason,
    admin_note: row.admin_note,
    is_read: row.is_read,
    read_at: row.read_at,
    delete_after_at: row.delete_after_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    moderation_provider: row.moderation_provider,
    moderation_model: row.moderation_model,
  };
}

async function listFeedbackEntries({
  fetchImpl = fetch,
  bucket = '',
  category = '',
  isRead = '',
  limit = 20,
  offset = 0,
} = {}) {
  const config = getSupabaseConfig();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);

  if (!config) {
    return {
      enabled: false,
      summary: buildFeedbackSummary([], Date.now()),
      grouped: groupFeedbackItems([]),
      items: [],
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        returned_count: 0,
      },
    };
  }

  const url = new URL(`${config.url}/rest/v1/feedback_entries`);
  url.searchParams.set('select', 'id,category,subject,body,bucket,ai_reason,admin_note,is_read,read_at,delete_after_at,created_at,updated_at,moderation_provider,moderation_model');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', String(safeLimit));
  url.searchParams.set('offset', String(safeOffset));

  if (bucket) {
    url.searchParams.set('bucket', `eq.${bucket}`);
  }

  if (category) {
    url.searchParams.set('category', `eq.${category}`);
  }

  if (isRead === true || isRead === false || isRead === 'true' || isRead === 'false') {
    url.searchParams.set('is_read', `eq.${String(isRead) === 'true'}`);
  }

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: getSupabaseHeaders(config, {
      Accept: 'application/json',
      Prefer: 'count=exact',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Feedback list failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  const items = Array.isArray(rows) ? rows.map(mapFeedbackRow) : [];

  return {
    enabled: true,
    summary: buildFeedbackSummary(items, Date.now()),
    grouped: groupFeedbackItems(items),
    items,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned_count: items.length,
    },
  };
}

async function updateFeedbackReadState({
  fetchImpl = fetch,
  id,
  isRead,
  now = new Date().toISOString(),
} = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      enabled: false,
      is_read: Boolean(isRead),
      read_at: isRead ? now : null,
      delete_after_at: isRead ? new Date(Date.parse(now) + (7 * 24 * 60 * 60 * 1000)).toISOString() : null,
    };
  }

  const readAt = isRead ? now : null;
  const deleteAfterAt = isRead
    ? new Date(Date.parse(now) + (7 * 24 * 60 * 60 * 1000)).toISOString()
    : null;

  const url = new URL(`${config.url}/rest/v1/feedback_entries`);
  url.searchParams.set('id', `eq.${Number(id)}`);

  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      is_read: Boolean(isRead),
      read_at: readAt,
      delete_after_at: deleteAfterAt,
      updated_at: now,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Feedback read update failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  return mapFeedbackRow(Array.isArray(rows) ? rows[0] : null);
}

async function restoreFeedbackEntry({
  fetchImpl = fetch,
  id,
  now = new Date().toISOString(),
} = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      enabled: false,
      id: Number(id),
      bucket: 'general',
      is_read: false,
      read_at: null,
      delete_after_at: null,
    };
  }

  const url = new URL(`${config.url}/rest/v1/feedback_entries`);
  url.searchParams.set('id', `eq.${Number(id)}`);

  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      bucket: 'general',
      is_read: false,
      read_at: null,
      delete_after_at: null,
      updated_at: now,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Feedback restore failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  return mapFeedbackRow(Array.isArray(rows) ? rows[0] : null);
}

async function moveFeedbackEntryToTrash({
  fetchImpl = fetch,
  id,
  reason = '',
  now = new Date().toISOString(),
} = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      enabled: false,
      id: Number(id),
      bucket: 'trash',
      admin_note: String(reason || ''),
      is_read: false,
      read_at: null,
      delete_after_at: null,
    };
  }

  const url = new URL(`${config.url}/rest/v1/feedback_entries`);
  url.searchParams.set('id', `eq.${Number(id)}`);

  const response = await fetchImpl(url, {
    method: 'PATCH',
    headers: getSupabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify({
      bucket: 'trash',
      admin_note: String(reason || ''),
      is_read: false,
      read_at: null,
      delete_after_at: null,
      updated_at: now,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Feedback trash move failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  return mapFeedbackRow(Array.isArray(rows) ? rows[0] : null);
}

async function purgeExpiredFeedbackEntries({
  fetchImpl = fetch,
  now = new Date().toISOString(),
} = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return { enabled: false, deletedCount: 0 };
  }

  const url = new URL(`${config.url}/rest/v1/feedback_entries`);
  url.searchParams.set('is_read', 'eq.true');
  url.searchParams.set('delete_after_at', `lte.${now}`);

  const response = await fetchImpl(url, {
    method: 'DELETE',
    headers: getSupabaseHeaders(config, {
      Prefer: 'return=representation',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Feedback purge failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const rows = await response.json();
  return {
    enabled: true,
    deletedCount: Array.isArray(rows) ? rows.length : 0,
  };
}

module.exports = {
  checkAndIncrementFeedbackRateLimit,
  createFeedbackEntry,
  getSupabaseConfig,
  getSupabaseHeaders,
  hashIpAddress,
  isFeedbackStorageConfigured,
  listFeedbackEntries,
  moveFeedbackEntryToTrash,
  purgeExpiredFeedbackEntries,
  restoreFeedbackEntry,
  updateFeedbackReadState,
};
