import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callGeminiWithFallback } from './_gemini.js';

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
            text: "You are a warm, encouraging art teacher looking at a student's 'Soul Painting' (灵魂画作). First, sincerely praise one specific thing about the drawing (effort, creativity, color choice, or boldness). Then gently and playfully guess what it might be. Be warm and supportive. Reply in Chinese, keeping it under 3 sentences. Never be dismissive or sarcastic.",
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
