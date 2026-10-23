// A small server that turns a meal photo into calorie and macro estimates with
// Claude. The API key stays here, never in the app.
//
//   ANTHROPIC_API_KEY=... npm run food-server
//
// Then set EXPO_PUBLIC_FOOD_AI_URL in .env to this server's address
// (e.g. http://192.168.1.20:8787 for a PC on the same Wi-Fi as the phone).
import Anthropic from '@anthropic-ai/sdk';
import { createServer } from 'node:http';
import { FOOD_PROMPT, FOOD_SCHEMA } from '../src/lib/foodPrompt';
import { normalizeEstimate } from '../src/lib/nutrition';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const client = new Anthropic();

async function estimate(imageBase64: string, mediaType: MediaType) {
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Portion estimates don't need deep reasoning; low effort keeps it quick and cheap.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: FOOD_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: FOOD_PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') {
    return { items: [], confidence: 'low' as const, note: "Couldn't analyse this photo. Try another one or add the food by hand." };
  }
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No estimate in the response');
  return normalizeEstimate(JSON.parse(text.text));
}

function send(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/estimate') return send(res, 404, { error: 'Not found' });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return send(res, 413, { error: 'Photo is too large' });
    chunks.push(chunk as Buffer);
  }
  try {
    const { imageBase64, mediaType } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof imageBase64 !== 'string' || !MEDIA_TYPES.includes(mediaType)) {
      return send(res, 400, { error: 'Send imageBase64 and a JPEG, PNG or WebP mediaType' });
    }
    send(res, 200, await estimate(imageBase64, mediaType));
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'The server has no valid ANTHROPIC_API_KEY' });
    if (error instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Too many photos at once, try again shortly' });
    if (error instanceof Anthropic.APIError) return send(res, 502, { error: `The AI service failed (${error.status})` });
    if (error instanceof SyntaxError) return send(res, 400, { error: 'Invalid JSON' });
    console.error(error);
    send(res, 500, { error: 'Something went wrong' });
  }
}).listen(PORT, () => console.log(`Food AI server on http://localhost:${PORT}/estimate`));
