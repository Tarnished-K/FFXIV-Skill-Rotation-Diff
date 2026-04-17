const feedbackDb = require('../lib/feedback-db');
const listHandler = require('../netlify/functions/feedback-admin-list').handler;
const markReadHandler = require('../netlify/functions/feedback-admin-mark-read').handler;

describe('feedback admin handlers', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  function mockAuthorizedAdmin() {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
      }),
    });
  }

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.ADMIN_EMAILS = 'admin@example.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalAnonKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = originalAnonKey;
    }

    if (originalAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    }
  });

  it('rejects list API requests without admin auth', async () => {
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(true);
    vi.spyOn(feedbackDb, 'listFeedbackEntries').mockResolvedValue({
      summary: { unread_count: 0, general_count: 0, trash_count: 0, pending_purge_count: 0 },
      items: [],
      pagination: { limit: 20, offset: 0, returned_count: 0 },
    });

    const response = await listHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 503 for list API when feedback storage is not configured', async () => {
    mockAuthorizedAdmin();
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(false);

    const response = await listHandler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer valid-token' },
      queryStringParameters: {},
    });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toBe('Feedback storage is not configured.');
  });

  it('returns summary, items, and pagination for list API', async () => {
    mockAuthorizedAdmin();
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(true);
    vi.spyOn(feedbackDb, 'listFeedbackEntries').mockResolvedValue({
      summary: { unread_count: 1, general_count: 1, trash_count: 0, pending_purge_count: 0 },
      items: [{
        id: 1,
        category: 'question',
        subject: '件名',
        body: '本文',
        bucket: 'general',
        is_read: false,
        created_at: '2026-04-17T00:00:00.000Z',
        delete_after_at: null,
        ai_reason: '',
        admin_note: '',
        moderation_provider: 'gemini',
        moderation_model: 'test-model',
      }],
      pagination: { limit: 20, offset: 0, returned_count: 1 },
    });

    const response = await listHandler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer valid-token' },
      queryStringParameters: {},
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.summary.unread_count).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.pagination.returned_count).toBe(1);
  });

  it('marks entries read and returns delete_after_at', async () => {
    mockAuthorizedAdmin();
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(true);
    vi.spyOn(feedbackDb, 'updateFeedbackReadState').mockResolvedValue({
      is_read: true,
      delete_after_at: '2026-04-24T00:00:00.000Z',
    });

    const response = await markReadHandler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: JSON.stringify({ id: 12, isRead: true }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).delete_after_at).toBe('2026-04-24T00:00:00.000Z');
  });

  it('rejects mark-read requests without admin auth', async () => {
    vi.spyOn(feedbackDb, 'isFeedbackStorageConfigured').mockReturnValue(true);
    vi.spyOn(feedbackDb, 'updateFeedbackReadState').mockResolvedValue({
      is_read: true,
      delete_after_at: '2026-04-24T00:00:00.000Z',
    });

    const response = await markReadHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ id: 12, isRead: true }),
    });

    expect(response.statusCode).toBe(401);
  });
});
