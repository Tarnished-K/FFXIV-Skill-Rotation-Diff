const { handler } = require('../netlify/functions/analytics-summary');

describe('analytics summary handler', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    process.env.ADMIN_EMAILS = 'admin@example.com';
  });

  afterEach(() => {
    vi.restoreAllMocks();

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

  it('rejects requests without admin auth', async () => {
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {},
    });

    expect(response.statusCode).toBe(401);
  });
});
