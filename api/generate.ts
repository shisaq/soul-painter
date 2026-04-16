import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callGeminiWithFallback } from './_gemini.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
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
            text: `You are a children's book illustrator creating cute, simple drawings for toddlers.
When given a prompt, generate a drawing that follows this "Weird Brush" style:
1. Recognizable Anatomy: Ensure the subject is easily recognizable. For animals, clearly define iconic features. Do not draw abstract blobs.
2. Chunky & Rounded: Use simple, oversized, rounded shapes.
3. Thick Outlines: Use very thick dark outlines (width: 8 to 15).
4. Flat, Bright Colors: Use solid, cheerful colors for fills.
5. Expressions: Add simple faces ONLY to characters or animals. Do not force faces on inanimate objects.

Output a JSON object with:
1. "thinking": A brief internal monologue about how you will draw this (in Chinese, under 15 words).
2. "steps": An array of drawing steps.

Each step is an object:
- "type": "stroke" or "fill"
- "color": hex color string
- "width": number (for strokes, make it 8-15)
- "path": SVG path data string (d attribute). Keep paths simple and rounded.
- "description": what this step is (in Chinese, very short)

Coordinate system: 500x500.
Prompt: "${prompt}"`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  try {
    const { text, exhausted } = await callGeminiWithFallback(apiKey, body);

    if (exhausted) {
      return res.status(429).json({ error: 'exhausted' });
    }

    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
