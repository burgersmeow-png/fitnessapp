/**
 * Address of the app's helper server (server/index.ts), from .env.local. It holds
 * the secrets the app must not carry: the AI key and the Strava client secret.
 */
export const SERVER_URL = (process.env.EXPO_PUBLIC_SERVER_URL ?? process.env.EXPO_PUBLIC_FOOD_AI_URL)?.replace(/\/$/, '');
