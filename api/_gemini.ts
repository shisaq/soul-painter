const MODELS = [
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash-lite',
];

function getApiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export async function callGeminiWithFallback(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ text: string; exhausted: boolean }> {
  for (const model of MODELS) {
    const response = await fetch(getApiUrl(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      continue; // Try next model
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response from model');
    }

    return { text, exhausted: false };
  }

  return { text: '', exhausted: true };
}
