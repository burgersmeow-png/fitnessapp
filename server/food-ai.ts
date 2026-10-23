// Turns a meal photo into calorie and macro estimates with Claude.
// The API key stays on the server, never in the app.
import Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FOOD_PROMPT, FOOD_SCHEMA } from '../src/lib/foodPrompt';
import { normalizeEstimate } from '../src/lib/nutrition';
import { BodyTooLarge, readJson, send } from './http';

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

// Created on first use, so the server still starts (for Strava) without an AI key.
let client: Anthropic | null = null;

async function estimate(imageBase64: string, mediaType: MediaType) {
  client ??= new Anthropic();
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

export const foodConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** POST /estimate with { imageBase64, mediaType }. */
export async function handleEstimate(req: IncomingMessage, res: ServerResponse) {
  try {
    const { imageBase64, mediaType } = (await readJson(req, MAX_BODY_BYTES)) as { imageBase64?: unknown; mediaType?: MediaType };
    if (typeof imageBase64 !== 'string' || !mediaType || !MEDIA_TYPES.includes(mediaType)) {
      return send(res, 400, { error: 'Send imageBase64 and a JPEG, PNG or WebP mediaType' });
    }
    send(res, 200, await estimate(imageBase64, mediaType));
  } catch (error) {
    if (error instanceof BodyTooLarge) return send(res, 413, { error: 'Photo is too large' });
    if (error instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'The server has no valid ANTHROPIC_API_KEY' });
    if (error instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Too many photos at once, try again shortly' });
    if (error instanceof Anthropic.APIError) return send(res, 502, { error: `The AI service failed (${error.status})` });
    if (error instanceof SyntaxError) return send(res, 400, { error: 'Invalid JSON' });
    console.error(error);
    send(res, 500, { error: 'Something went wrong' });
  }
}
