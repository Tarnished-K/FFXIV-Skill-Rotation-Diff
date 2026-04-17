const { decideFeedbackBucket } = require('../lib/feedback-moderation');

describe('decideFeedbackBucket', () => {
  it('routes explicit Japanese harassment to trash before calling Gemini', async () => {
    const fetchImpl = vi.fn();

    await expect(decideFeedbackBucket({
      fetchImpl,
      apiKey: 'test-key',
      model: 'gemini-2.5-flash-lite',
      subject: '\u30a2\u30a6\u30c8',
      body: '\u6b7b\u306d',
    })).resolves.toEqual({
      bucket: 'trash',
      reason: 'explicit_abuse_phrase',
      provider: 'rule',
      model: 'gemini-2.5-flash-lite',
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('routes explicit Japanese self-harm harassment to trash before calling Gemini', async () => {
    const fetchImpl = vi.fn();

    await expect(decideFeedbackBucket({
      fetchImpl,
      apiKey: 'test-key',
      model: 'gemini-2.5-flash-lite',
      subject: '\u30a2\u30a6\u30c8',
      body: '\u81ea\u6bba\u3057\u308d',
    })).resolves.toEqual({
      bucket: 'trash',
      reason: 'explicit_abuse_phrase',
      provider: 'rule',
      model: 'gemini-2.5-flash-lite',
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('normalizes Gemini model output into general/trash', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '{"bucket":"trash","reason":"abusive content"}',
                },
              ],
            },
          },
        ],
      }),
    });

    await expect(decideFeedbackBucket({
      fetchImpl,
      apiKey: 'test-key',
      model: 'gemini-2.5-flash-lite',
      subject: 'hello',
      body: 'you are terrible',
    })).resolves.toEqual({
      bucket: 'trash',
      reason: 'abusive content',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-goog-api-key': 'test-key',
        }),
      }),
    );

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.system_instruction.parts[0].text).toContain('\u6b7b\u306d');
    expect(requestBody.system_instruction.parts[0].text).toContain('kill yourself');
    expect(requestBody.system_instruction.parts[0].text).toContain('Prioritize Japanese-language moderation');
    expect(requestBody.system_instruction.parts[0].text).toContain('Short Japanese abuse or violent wishes must be trash');
  });
});
