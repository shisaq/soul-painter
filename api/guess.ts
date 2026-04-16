import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callGeminiWithFallback } from './_gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: "You are an expert art critic analyzing a 'Soul Painting' (灵魂画作) - a drawing that might be abstract, poorly drawn, or very simple, but captures the essence of the subject. Guess what this drawing is. Be encouraging, humorous, and creative. Reply in Chinese, keeping it under 3 sentences.",
          },
          {
            inlineData: {
              data: image,
              mimeType: 'image/jpeg',
            },
          },
        ],
      },
    ],
  };

  try {
    const { text, exhausted } = await callGeminiWithFallback(apiKey, body);

    if (exhausted) {
      return res.status(429).json({ error: 'exhausted' });
    }

    return res.status(200).json({ result: text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
