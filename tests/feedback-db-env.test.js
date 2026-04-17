const feedbackDb = require('../lib/feedback-db');

describe('feedback-db env loading', () => {
  const originalNetlify = globalThis.Netlify;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Netlify = originalNetlify;

    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    }
  });

  it('reads Supabase config from Netlify env when process env is unavailable', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.Netlify = {
      env: {
        get: vi.fn((name) => {
          if (name === 'SUPABASE_URL') return 'https://example.supabase.co/';
          if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
          return '';
        }),
      },
    };

    expect(feedbackDb.getSupabaseConfig()).toEqual({
      url: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
    });
  });

  it('falls back to process env when Netlify env is absent', () => {
    process.env.SUPABASE_URL = 'https://fallback.supabase.co/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fallback-key';
    globalThis.Netlify = undefined;

    expect(feedbackDb.getSupabaseConfig()).toEqual({
      url: 'https://fallback.supabase.co',
      serviceRoleKey: 'fallback-key',
    });
  });
});
