const {
  buildFeedbackEntryMarkup,
  sortFeedbackItems,
} = require('../scripts/shared/feedback-admin.js');

describe('sortFeedbackItems', () => {
  it('sorts unread items first, then newer items first within the same read state', () => {
    const sorted = sortFeedbackItems([
      { id: 1, is_read: true, created_at: '2026-04-17T00:00:00.000Z' },
      { id: 2, is_read: false, created_at: '2026-04-16T00:00:00.000Z' },
      { id: 3, is_read: false, created_at: '2026-04-18T00:00:00.000Z' },
      { id: 4, is_read: true, created_at: '2026-04-19T00:00:00.000Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([3, 2, 4, 1]);
  });
});

describe('buildFeedbackEntryMarkup', () => {
  it('escapes user-provided content and shows the AI reason in trash view', () => {
    const markup = buildFeedbackEntryMarkup({
      id: 9,
      category: 'question',
      subject: '<script>alert(1)</script>',
      body: '本文 & "quoted"',
      created_at: '2026-04-17T00:00:00.000Z',
      ai_reason: 'abusive <content>',
      is_read: false,
      delete_after_at: null,
    }, {
      isGeneral: false,
      categoryLabels: {
        question: '質問',
      },
    });

    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(markup).toContain('本文 &amp; &quot;quoted&quot;');
    expect(markup).toContain('AI 判定理由');
    expect(markup).toContain('abusive &lt;content&gt;');
  });
});
