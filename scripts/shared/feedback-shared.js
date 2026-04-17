(function attachFeedbackShared(root, factory) {
  const exports = factory();
  root.FeedbackShared = exports;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFeedbackShared() {
  const FEEDBACK_BUCKETS = ['general', 'trash'];
  const FEEDBACK_CATEGORIES = ['bug_report', 'feature_request', 'question', 'other'];
  const CATEGORY_LABELS = {
    bug_report: '不具合報告',
    feature_request: '改善要望',
    question: '質問',
    other: 'その他',
  };
  const MAX_SUBJECT_LENGTH = 200;
  const MAX_BODY_LENGTH = 2000;
  const HONEYPOT_FIELD = 'website';

  function normalizeFeedbackInput(input = {}) {
    const category = String(input.category || '').trim();
    const subject = String(input.subject || '').trim();
    const body = String(input.body || '').trim();
    const honeypot = String(input[HONEYPOT_FIELD] || '').trim();

    const isValid = FEEDBACK_CATEGORIES.includes(category)
      && subject.length > 0
      && subject.length <= MAX_SUBJECT_LENGTH
      && body.length > 0
      && body.length <= MAX_BODY_LENGTH
      && !honeypot;

    if (!isValid) {
      return { ok: false, error: 'Invalid feedback input.' };
    }

    return {
      ok: true,
      value: {
        category,
        subject,
        body,
      },
    };
  }

  return {
    CATEGORY_LABELS,
    FEEDBACK_BUCKETS,
    FEEDBACK_CATEGORIES,
    HONEYPOT_FIELD,
    MAX_BODY_LENGTH,
    MAX_SUBJECT_LENGTH,
    normalizeFeedbackInput,
  };
}));
