import { normalizeEstimate, type PhotoEstimate } from '../lib/nutrition';
import { SERVER_URL } from './server';

export const foodAiConfigured = !!SERVER_URL;

export class FoodAiError extends Error {}

/** Sends a meal photo to the food AI server and returns a checked estimate. */
export async function estimatePhoto(imageBase64: string, mediaType: string): Promise<PhotoEstimate> {
  if (!SERVER_URL) throw new FoodAiError('Photo estimates aren’t set up yet. Add the food by hand for now.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${SERVER_URL}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mediaType }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new FoodAiError(typeof body.error === 'string' ? body.error : `The food AI server returned ${res.status}.`);
    return normalizeEstimate(body);
  } catch (error) {
    if (error instanceof FoodAiError) throw error;
    throw new FoodAiError('Couldn’t reach the food AI. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}
