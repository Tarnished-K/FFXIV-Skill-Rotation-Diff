const {
  buildFeedbackSummary,
  groupFeedbackItems,
} = require('../lib/feedback-list-utils');

describe('buildFeedbackSummary', () => {
  it('counts unread, general, trash, and purge candidates', () => {
    const rows = [
      { bucket: 'general', is_read: false, delete_after_at: null },
      { bucket: 'general', is_read: true, delete_after_at: '2026-04-20T00:00:00.000Z' },
      { bucket: 'trash', is_read: false, delete_after_at: null },
      { bucket: 'trash', is_read: true, delete_after_at: '2026-04-10T00:00:00.000Z' },
    ];

    expect(buildFeedbackSummary(rows, Date.parse('2026-04-17T00:00:00.000Z'))).toEqual({
      unread_count: 2,
      general_count: 2,
      trash_count: 2,
      pending_purge_count: 1,
    });
  });
});

describe('groupFeedbackItems', () => {
  it('groups only general items by category and leaves trash flat', () => {
    const rows = [
      { id: 1, bucket: 'general', category: 'bug_report' },
      { id: 2, bucket: 'general', category: 'question' },
      { id: 3, bucket: 'trash', category: 'feature_request' },
    ];

    expect(groupFeedbackItems(rows).general.bug_report).toHaveLength(1);
    expect(groupFeedbackItems(rows).general.question).toHaveLength(1);
    expect(groupFeedbackItems(rows).trash).toHaveLength(1);
  });
});
