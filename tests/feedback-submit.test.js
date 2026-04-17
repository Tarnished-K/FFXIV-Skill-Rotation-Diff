const feedbackDb = require('../lib/feedback-db');
const feedbackModeration = require('../lib/feedback-moderation');
const { handler } = require('../netlify/functions/feedback-submit');

describe('feedback-submit handler', () => {
  const originalNetlify = globalThis.Netlify;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Netlify = originalNetlify;
  });

  it('returns 503 when feedback storage is not configured', async () => {
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(false);

    const response = await handler({
      httpMethod: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.8' },
      body: JSON.stringify({
        category: 'question',
        subject: '件名',
        body: '本文',
        website: '',
      }),
    });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toBe('Feedback storage is not configured.');
  });

  it('returns 429 before moderation when rate limit is exceeded', async () => {
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(true);
    vi.spyOn(feedbackDb, 'checkAndIncrementFeedbackRateLimit').mockResolvedValue({ allowed: false });
    const moderationSpy = vi.spyOn(feedbackModeration, 'decideFeedbackBucket');

    const response = await handler({
      httpMethod: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.8' },
      body: JSON.stringify({
        category: 'question',
        subject: '件名',
        body: '本文',
        website: '',
      }),
    });

    expect(response.statusCode).toBe(429);
    expect(moderationSpy).not.toHaveBeenCalled();
  });

  it('reads moderation settings from Netlify env when available', async () => {
    globalThis.Netlify = {
      env: {
        get: vi.fn((name) => {
          if (name === 'GEMINI_API_KEY') return 'netlify-gemini-key';
          if (name === 'GEMINI_FEEDBACK_MODEL') return 'gemini-2.5-flash-lite';
          return '';
        }),
      },
    };

    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(true);
    vi.spyOn(feedbackDb, 'checkAndIncrementFeedbackRateLimit').mockResolvedValue({
      allowed: true,
      ipHash: 'hashed-ip',
    });
    vi.spyOn(feedbackDb, 'createFeedbackEntry').mockResolvedValue({
      enabled: true,
      row: { id: 1 },
    });
    const moderationSpy = vi.spyOn(feedbackModeration, 'decideFeedbackBucket').mockResolvedValue({
      bucket: 'general',
      reason: 'moderation_fallback',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
    });

    const response = await handler({
      httpMethod: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.8' },
      body: JSON.stringify({
        category: 'question',
        subject: 'subject',
        body: 'body',
        website: '',
      }),
    });

    expect(response.statusCode).toBe(202);
    expect(moderationSpy).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'netlify-gemini-key',
      model: 'gemini-2.5-flash-lite',
    }));
  });
});
