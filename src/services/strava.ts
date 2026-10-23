import type { SQLiteDatabase } from 'expo-sqlite';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { importCardio, loadRecord, saveRecord } from '../lib/db';
import {
  activityToCardio,
  needsRefresh,
  tokensFromRedirect,
  workoutToActivity,
  type StravaActivity,
  type StravaTokens,
  type WorkoutForStrava,
} from '../lib/strava';
import { SERVER_URL } from './server';

// Overridable only so the flow can be tested against a stand-in Strava.
const STRAVA = (process.env.EXPO_PUBLIC_STRAVA_URL ?? 'https://www.strava.com').replace(/\/$/, '');
const API = `${STRAVA}/api/v3`;
const KEY = 'strava';
/** How far back the first sync looks. */
const FIRST_SYNC_DAYS = 30;
/** Automatic syncs (on opening Today) happen at most this often. */
const AUTO_SYNC_MS = 30 * 60_000;

export interface StravaLink extends StravaTokens {
  /** ISO time of the last successful import. */
  lastSyncAt: string | null;
}

export class StravaError extends Error {}

/**
 * Off until switched on in .env.local (EXPO_PUBLIC_STRAVA_ENABLED=1). Since June 2026 Strava
 * requires a paid subscription on the developer's account to create an API app.
 */
export const stravaEnabled = process.env.EXPO_PUBLIC_STRAVA_ENABLED === '1' && !!SERVER_URL;

export const loadStravaLink = (db: SQLiteDatabase) => loadRecord<StravaLink>(db, KEY);

/** Opens Strava's sign-in in a browser sheet. Returns the link, or null if the athlete cancelled. */
export async function connectStrava(db: SQLiteDatabase): Promise<StravaLink | null> {
  if (!SERVER_URL) throw new StravaError('Strava isn’t set up yet. See “Connect Strava” in the README.');
  const returnUrl = Linking.createURL('strava');
  const result = await WebBrowser.openAuthSessionAsync(`${SERVER_URL}/strava/start?return=${encodeURIComponent(returnUrl)}`, returnUrl);
  if (result.type !== 'success') return null;
  const tokens = tokensFromRedirect(result.url);
  if ('error' in tokens) {
    if (tokens.error === 'access_denied') return null;
    throw new StravaError('Strava sign-in didn’t finish. Try again.');
  }
  const link: StravaLink = { ...tokens, lastSyncAt: null };
  await saveRecord(db, KEY, link);
  return link;
}

/** Forgets the sign-in here and asks Strava to revoke it (best effort). */
export async function disconnectStrava(db: SQLiteDatabase): Promise<void> {
  const link = await loadStravaLink(db);
  await saveRecord(db, KEY, null);
  if (link) {
    // Strava replaces this with /oauth/revoke on 1 June 2027.
    fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${link.accessToken}` } }).catch(() => {});
  }
}

/** A current access token, refreshed through the server when it is about to expire. */
async function freshLink(db: SQLiteDatabase): Promise<StravaLink> {
  const link = await loadStravaLink(db);
  if (!link) throw new StravaError('Strava isn’t connected.');
  if (!needsRefresh(link)) return link;
  const res = await fetch(`${SERVER_URL}/strava/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: link.refreshToken }),
  }).catch(() => null);
  if (!res?.ok) throw new StravaError('Couldn’t reach Strava. Check your connection, or connect Strava again.');
  const t = (await res.json()) as Pick<StravaTokens, 'accessToken' | 'refreshToken' | 'expiresAt'>;
  const next = { ...link, ...t };
  await saveRecord(db, KEY, next);
  return next;
}

async function api<T>(link: StravaLink, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${link.accessToken}` },
  }).catch(() => null);
  if (!res) throw new StravaError('Couldn’t reach Strava. Check your connection.');
  if (res.status === 401 || res.status === 403) throw new StravaError('Strava needs permission again. Disconnect and connect Strava.');
  if (res.status === 429) throw new StravaError('Strava is busy. Try again in a few minutes.');
  if (!res.ok) throw new StravaError(`Strava returned an error (${res.status}).`);
  return (await res.json()) as T;
}

/** Imports new runs, rides, swims and other cardio. Returns how many sessions were added. */
export async function syncStrava(db: SQLiteDatabase): Promise<number> {
  const link = await freshLink(db);
  // Look back a day past the last sync so late uploads from a watch still come in.
  const fromMs = link.lastSyncAt ? Date.parse(link.lastSyncAt) - 864e5 : Date.now() - FIRST_SYNC_DAYS * 864e5;
  const after = Math.floor(fromMs / 1000);
  const sessions = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await api<StravaActivity[]>(link, `/athlete/activities?after=${after}&per_page=100&page=${page}`);
    for (const a of batch) {
      const s = activityToCardio(a);
      if (s) sessions.push(s);
    }
    if (batch.length < 100) break;
  }
  const added = await importCardio(db, sessions);
  await saveRecord(db, KEY, { ...link, lastSyncAt: new Date().toISOString() });
  return added;
}

/** Syncs when connected and the last sync is old enough. Never throws: it runs in the background. */
export async function syncStravaIfDue(db: SQLiteDatabase): Promise<number> {
  try {
    const link = await loadStravaLink(db);
    if (!link || (link.lastSyncAt && Date.now() - Date.parse(link.lastSyncAt) < AUTO_SYNC_MS)) return 0;
    return await syncStrava(db);
  } catch {
    return 0;
  }
}

/** Posts a finished strength workout to Strava. Returns the activity's web address. */
export async function postWorkoutToStrava(db: SQLiteDatabase, workout: WorkoutForStrava): Promise<string> {
  const link = await freshLink(db);
  if (!link.canPost) throw new StravaError('Strava didn’t allow uploads. Disconnect and connect again with “Upload your activities” ticked.');
  const body = workoutToActivity(workout);
  const created = await api<{ id: number }>(link, '/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString(),
  });
  return `${STRAVA}/activities/${created.id}`;
}
