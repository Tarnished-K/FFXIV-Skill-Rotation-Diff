function buildFeedbackSummary(rows, nowMs = Date.now()) {
  return rows.reduce((summary, row) => {
    if (!row.is_read) {
      summary.unread_count += 1;
    }

    if (row.bucket === 'general') {
      summary.general_count += 1;
    }

    if (row.bucket === 'trash') {
      summary.trash_count += 1;
    }

    if (row.is_read && row.delete_after_at && Date.parse(row.delete_after_at) <= nowMs) {
      summary.pending_purge_count += 1;
    }

    return summary;
  }, {
    unread_count: 0,
    general_count: 0,
    trash_count: 0,
    pending_purge_count: 0,
  });
}

function groupFeedbackItems(rows) {
  const grouped = {
    general: {
      bug_report: [],
      feature_request: [],
      question: [],
      other: [],
    },
    trash: [],
  };

  rows.forEach((row) => {
    if (row.bucket === 'trash') {
      grouped.trash.push(row);
      return;
    }

    if (grouped.general[row.category]) {
      grouped.general[row.category].push(row);
    }
  });

  return grouped;
}

module.exports = {
  buildFeedbackSummary,
  groupFeedbackItems,
};
