const crypto = require('crypto');

function signPayload(rawBody, secret) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function makeEvent(stripeEvent) {
  const secret = 'whsec_test_secret';
  const rawBody = JSON.stringify(stripeEvent);
  return {
    httpMethod: 'POST',
    headers: { 'stripe-signature': signPayload(rawBody, secret) },
    body: rawBody,
  };
}

function mockResponse({ status = 200, body = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function mockFetchSequence(responses) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(mockResponse(response));
  }
  global.fetch = fetchMock;
  return fetchMock;
}

async function loadHandler() {
  vi.resetModules();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  return require('../netlify/functions/stripe-webhook').handler;
}

describe('stripe webhook handler', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    global.fetch = originalFetch;
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
    if (originalSupabaseUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRoleKey;
    }
  });

  it('uses subscription item period end when Stripe omits top-level current_period_end', async () => {
    const fetchMock = mockFetchSequence([
      { status: 201 },
      { status: 201 },
      { status: 201 },
      { status: 204 },
    ]);
    const handler = await loadHandler();

    const response = await handler(makeEvent({
      id: 'evt_subscription_created',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test',
          customer: 'cus_test',
          status: 'active',
          cancel_at_period_end: false,
          metadata: { user_id: 'user-test' },
          items: {
            data: [{ current_period_end: 1780290213 }],
          },
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toBe('https://example.supabase.co/rest/v1/billing_customers');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      user_id: 'user-test',
      stripe_customer_id: 'cus_test',
    });
    expect(fetchMock.mock.calls[2][0]).toBe('https://example.supabase.co/rest/v1/billing_subscriptions');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(expect.objectContaining({
      id: 'sub_test',
      user_id: 'user-test',
      stripe_customer_id: 'cus_test',
      status: 'active',
      current_period_end: new Date(1780290213 * 1000).toISOString(),
      cancel_at_period_end: false,
    }));
    expect(String(fetchMock.mock.calls[3][0])).toContain('stripe_event_id=eq.evt_subscription_created');
  });

  it('reprocesses duplicate webhook events that were recorded but not processed', async () => {
    const fetchMock = mockFetchSequence([
      { status: 409 },
      { status: 200, body: [{ processed_at: null }] },
      { status: 201 },
      { status: 201 },
      { status: 204 },
    ]);
    const handler = await loadHandler();

    const response = await handler(makeEvent({
      id: 'evt_retry',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_retry',
          customer: 'cus_retry',
          status: 'active',
          current_period_end: 1780290213,
          metadata: { user_id: 'user-retry' },
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[2][0]).toBe('https://example.supabase.co/rest/v1/billing_customers');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      user_id: 'user-retry',
      stripe_customer_id: 'cus_retry',
    });
    expect(fetchMock.mock.calls[3][0]).toBe('https://example.supabase.co/rest/v1/billing_subscriptions');
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual(expect.objectContaining({
      id: 'sub_retry',
      user_id: 'user-retry',
    }));
    expect(String(fetchMock.mock.calls[4][0])).toContain('stripe_event_id=eq.evt_retry');
  });

  it('skips duplicate webhook events that were already processed', async () => {
    const fetchMock = mockFetchSequence([
      { status: 409 },
      { status: 200, body: [{ processed_at: '2026-05-01T05:00:00.000Z' }] },
    ]);
    const handler = await loadHandler();

    const response = await handler(makeEvent({
      id: 'evt_processed',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_processed',
          customer: 'cus_processed',
          status: 'active',
          current_period_end: 1780290213,
          metadata: { user_id: 'user-processed' },
        },
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true, skipped: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects signatures outside the timestamp tolerance', async () => {
    const handler = await loadHandler();
    const secret = 'whsec_test_secret';
    const rawBody = JSON.stringify({ id: 'evt_old', type: 'customer.subscription.updated', data: { object: {} } });
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');

    const response = await handler({
      httpMethod: 'POST',
      headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body: rawBody,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toBe('Invalid signature');
  });
});
