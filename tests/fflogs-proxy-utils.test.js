const {
  MISSING_ENV_MESSAGE,
  PUBLIC_ONLY_MESSAGE,
  inferStatusCode,
  normalizeErrorMessage,
} = require('../lib/fflogs-proxy-utils');

describe('normalizeErrorMessage', () => {
  it('normalizes missing env errors into a user-facing message', () => {
    expect(normalizeErrorMessage('Missing required environment variable: FFLOGS_CLIENT_ID')).toBe(MISSING_ENV_MESSAGE);
  });

  it('normalizes private or forbidden errors into a public-only message', () => {
    expect(normalizeErrorMessage('Client authorization failed for private report')).toBe(PUBLIC_ONLY_MESSAGE);
  });

  it('leaves unrelated errors untouched', () => {
    expect(normalizeErrorMessage('Request failed: 500')).toBe('Request failed: 500');
  });
});

describe('inferStatusCode', () => {
  it('returns the expected status codes for normalized messages', () => {
    expect(inferStatusCode(PUBLIC_ONLY_MESSAGE)).toBe(403);
    expect(inferStatusCode(MISSING_ENV_MESSAGE)).toBe(500);
    expect(inferStatusCode('Request failed: 500')).toBe(502);
  });
});
