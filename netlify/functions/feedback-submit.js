const { normalizeFeedbackInput } = require('../../scripts/shared/feedback-shared.js');
const feedbackDb = require('../../lib/feedback-db');
const feedbackModeration = require('../../lib/feedback-moderation');
const { readRuntimeEnv } = require('../../lib/runtime-env');

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: JSON_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Request body must be valid JSON.' });
  }
  const normalized = normalizeFeedbackInput(payload);
  if (!normalized.ok) {
    return json(400, { ok: false, error: normalized.error });
  }

  if (!feedbackDb.isFeedbackStorageConfigured()) {
    return json(503, { ok: false, error: 'Feedback storage is not configured.' });
  }

  const ip = String(event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || '')
    .split(',')[0]
    .trim();

  const rate = await feedbackDb.checkAndIncrementFeedbackRateLimit({
    ip,
    now: new Date().toISOString(),
  });

  if (!rate.allowed) {
    return json(429, { ok: false, error: 'Too Many Requests' });
  }

  const moderation = await feedbackModeration.decideFeedbackBucket({
    apiKey: readRuntimeEnv('GEMINI_API_KEY'),
    model: readRuntimeEnv('GEMINI_FEEDBACK_MODEL') || 'gemini-2.5-flash-lite',
    subject: normalized.value.subject,
    body: normalized.value.body,
  });

  await feedbackDb.createFeedbackEntry({
    ...normalized.value,
    bucket: moderation.bucket,
    aiReason: moderation.reason,
    moderationProvider: moderation.provider,
    moderationModel: moderation.model,
    ipHash: rate.ipHash || '',
  });

  return json(202, {
    ok: true,
    bucket: moderation.bucket,
  });
};
