(function attachFeedbackForm(root) {
  const shared = root.FeedbackShared;
  if (!shared) {
    return;
  }

  const submitButton = document.getElementById('feedbackSubmitBtn');
  const messageEl = document.getElementById('feedbackMessage');

  async function submitFeedback() {
    const payload = {
      category: document.getElementById('feedbackCategory')?.value || '',
      subject: document.getElementById('feedbackSubject')?.value || '',
      body: document.getElementById('feedbackBody')?.value || '',
      website: document.getElementById('feedbackWebsite')?.value || '',
    };

    const normalized = shared.normalizeFeedbackInput(payload);
    if (!normalized.ok) {
      messageEl.textContent = '入力内容を確認してください。';
      return;
    }

    submitButton.disabled = true;
    messageEl.textContent = '送信中...';

    try {
      const response = await fetch('/api/feedback-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        messageEl.textContent = json.error || '送信に失敗しました。';
        return;
      }

      messageEl.textContent = '送信しました。ありがとうございます。';
      document.getElementById('feedbackSubject').value = '';
      document.getElementById('feedbackBody').value = '';
      document.getElementById('feedbackWebsite').value = '';
    } catch {
      messageEl.textContent = '送信に失敗しました。';
    } finally {
      submitButton.disabled = false;
    }
  }

  submitButton?.addEventListener('click', submitFeedback);
}(typeof globalThis !== 'undefined' ? globalThis : this));
