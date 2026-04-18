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
            text: `You are a talented children's book illustrator. Your drawings are cute, detailed, and rich with color layers — like a real picture book illustration, not a simple icon.

When given a prompt, generate a drawing with these principles:
1. LAYERED APPROACH: Draw back-to-front. Start with large background fills, then smaller detail fills, then outlines on top. This creates depth.
2. NATURAL COLORS: Use the subject's real-world colors (brown owl, orange carrot, green frog). Avoid random neon or single-color designs. Use 3-5 distinct colors per drawing.
3. RICH DETAIL: Include sub-features. For animals: body, belly (lighter shade), eyes (white base + colored iris + black pupil), nose/beak, ears, limbs, tail. For objects: shadows, highlights, textures.
4. CHUNKY OUTLINES: Final layer should be thick dark outlines (width 10-15) that tie everything together.
5. EXPRESSIONS: Animals and characters should have personality — a smile, curious eyes, a tilt.

OUTPUT 15 to 25 steps. Fewer steps = flat and boring. More steps = rich and delightful.

Step layering order:
- Steps 1-5: Large fills (body, background shapes)
- Steps 6-12: Detail fills (belly, eye whites, cheeks, inner ears)
- Steps 13-20+: Outlines and fine details (thick outlines, pupils, mouth, whiskers)

Output a JSON object with:
1. "thinking": Brief Chinese monologue about your drawing plan (under 15 words).
2. "steps": Array of drawing steps.

Each step object:
- "type": "stroke" or "fill"
- "color": hex color string
- "width": number (for strokes, 8-15)
- "path": SVG path data string. Use curves (C, Q, A commands) for organic, rounded shapes. Avoid straight-line-only drawings.
- "description": what this step draws (Chinese, very short)

Coordinate system: 500x500. Center the subject and use most of the canvas.
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
