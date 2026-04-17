const EXPLICIT_ABUSE_PATTERNS = [
  /\u6b7b\u306d/u,
  /\u3057\u306d/u,
  /\u304f\u305f\u3070\u308c/u,
  /\u6d88\u3048\u308d/u,
  /\u5931\u305b\u308d/u,
  /\u81ea\u6bba\u3057\u308d/u,
  /\u9996\u3064\u308c/u,
  /\u3076\u3063\u6bba\u3059/u,
  /\u6bba\u3059\u305e/u,
  /\u6bba\u3059/u,
  /\u3053\u308d\u3059/u,
  /\bkill yourself\b/i,
  /\bgo die\b/i,
  /\bdrop dead\b/i,
];

function hasExplicitAbusePhrase(...texts) {
  const combined = texts
    .map((text) => String(text || '').trim())
    .filter(Boolean)
    .join('\n');

  return EXPLICIT_ABUSE_PATTERNS.some((pattern) => pattern.test(combined));
}

function buildSystemPrompt() {
  return [
    'Return compact JSON {"bucket":"general|trash","reason":"specific short reason"}.',
    'Prioritize Japanese-language moderation because Japanese is expected to be the primary user language.',
    'Classify as trash for direct abuse, harassment, slurs, violent wishes, or clear hostile attacks in any language.',
    'Short Japanese abuse or violent wishes must be trash even when the message is only one or two words.',
    'Japanese examples that must be trash: "\u6b7b\u306d", "\u304f\u305f\u3070\u308c", "\u6d88\u3048\u308d", "\u81ea\u6bba\u3057\u308d", "\u9996\u3064\u308c", "\u6bba\u3059".',
    'English examples that must be trash: "kill yourself", "go die", "drop dead", "you are a useless idiot".',
    'Feature requests, bug reports, neutral criticism, and ordinary questions must be general.',
    'Do not output the literal placeholder "short reason".',
  ].join(' ');
}

async function decideFeedbackBucket({
  fetchImpl = fetch,
  apiKey,
  model,
  subject,
  body,
}) {
  const fallback = {
    bucket: 'general',
    reason: 'moderation_fallback',
    provider: 'gemini',
    model,
  };

  if (!apiKey) {
    return fallback;
  }

  if (hasExplicitAbusePhrase(subject, body)) {
    return {
      bucket: 'trash',
      reason: 'explicit_abuse_phrase',
      provider: 'rule',
      model,
    };
  }

  const response = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: buildSystemPrompt(),
            },
          ],
        },
        contents: [
          {
            parts: [
              {
                text: `subject: ${subject}\nbody: ${body}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    return fallback;
  }

  const json = await response.json();
  const outputText = Array.isArray(json.candidates)
    ? json.candidates
        .flatMap((candidate) => candidate?.content?.parts || [])
        .map((part) => part?.text || '')
        .join('')
    : '';

  try {
    const parsed = JSON.parse(outputText || '{}');
    return {
      bucket: parsed.bucket === 'trash' ? 'trash' : 'general',
      reason: String(parsed.reason || 'moderation_ok'),
      provider: 'gemini',
      model,
    };
  } catch {
    return fallback;
  }
}

module.exports = {
  decideFeedbackBucket,
};
