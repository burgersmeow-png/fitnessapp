/**
 * Address of the app's helper server (server/index.ts), from .env.local. It holds
 * the secrets the app must not carry: the AI key and the Strava client secret.
 */
export const SERVER_URL = (process.env.EXPO_PUBLIC_SERVER_URL ?? process.env.EXPO_PUBLIC_FOOD_AI_URL)?.replace(/\/$/, '');

/** The public landing page that shared links point to (site/ in this repo, on GitHub Pages). */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://burgersmeow-png.github.io/fitnessapp/').replace(/\/?$/, '/');
