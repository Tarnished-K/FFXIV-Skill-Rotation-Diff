const {
  FEEDBACK_BUCKETS,
  FEEDBACK_CATEGORIES,
  MAX_BODY_LENGTH,
  MAX_SUBJECT_LENGTH,
  normalizeFeedbackInput,
} = require('../scripts/shared/feedback-shared.js');

describe('normalizeFeedbackInput', () => {
  it('accepts valid category, subject, and body', () => {
    expect(normalizeFeedbackInput({
      category: 'bug_report',
      subject: '件名',
      body: '本文です',
      website: '',
    })).toEqual({
      ok: true,
      value: {
        category: 'bug_report',
        subject: '件名',
        body: '本文です',
      },
    });
  });

  it('rejects invalid category and empty fields', () => {
    expect(normalizeFeedbackInput({
      category: 'unknown',
      subject: ' ',
      body: '',
      website: '',
    })).toEqual({
      ok: false,
      error: 'Invalid feedback input.',
    });
  });

  it('rejects honeypot spam and oversized input', () => {
    expect(MAX_SUBJECT_LENGTH).toBe(200);
    expect(MAX_BODY_LENGTH).toBe(2000);
    expect(FEEDBACK_BUCKETS).toEqual(['general', 'trash']);
    expect(FEEDBACK_CATEGORIES).toEqual(['bug_report', 'feature_request', 'question', 'other']);

    expect(normalizeFeedbackInput({
      category: 'question',
      subject: 'x'.repeat(201),
      body: '本文',
      website: 'bot-filled',
    })).toEqual({
      ok: false,
      error: 'Invalid feedback input.',
    });
  });
});
