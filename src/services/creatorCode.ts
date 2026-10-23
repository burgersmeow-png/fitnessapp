import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import { newInstallId, type CreatorState } from '../lib/creatorCode';
import { SERVER_URL } from './server';

const STATE = 'creator-code';
const INSTALL = 'install-id';

export const creatorCodesAvailable = () => !!SERVER_URL;
export const loadCreator = (db: SQLiteDatabase) => loadRecord<CreatorState>(db, STATE);

async function installId(db: SQLiteDatabase): Promise<string> {
  const existing = await loadRecord<string>(db, INSTALL);
  if (existing) return existing;
  const id = newInstallId();
  await saveRecord(db, INSTALL, id);
  return id;
}

/** Looks a code up on the server. Throws with a message to show when it isn't valid. */
export async function checkCode(code: string): Promise<{ code: string; creatorName: string; welcome: string | null }> {
  if (!SERVER_URL) throw new Error('Creator codes aren’t available yet.');
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}/ref/check?code=${encodeURIComponent(code)}`);
  } catch {
    throw new Error('No connection. Try again when you’re online.');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; creatorName?: string; welcome?: string | null };
  if (!res.ok || !body.creatorName) throw new Error(body.error ?? 'That code isn’t valid.');
  return { code: body.code ?? code, creatorName: body.creatorName, welcome: body.welcome ?? null };
}

/** Keeps the code on this phone and tells the server, now or the next time it can. */
export async function applyCode(db: SQLiteDatabase, found: { code: string; creatorName: string; welcome: string | null }): Promise<void> {
  if (await loadCreator(db)) return; // The first code keeps the credit.
  await saveRecord(db, STATE, { ...found, claimed: false, activeSent: false } satisfies CreatorState);
  await flushCreator(db);
}

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends anything the server hasn't heard yet: the sign-up, then (once a workout is finished)
 * that this install became an active user. Safe to call often; it does nothing once both are sent.
 */
export async function flushCreator(db: SQLiteDatabase): Promise<void> {
  const state = await loadCreator(db);
  if (!state || !SERVER_URL || (state.claimed && state.activeSent)) return;
  const id = await installId(db);
  let next = state;
  if (!next.claimed && (await post('/ref/claim', { code: state.code, installId: id }))) next = { ...next, claimed: true };
  if (next.claimed && !next.activeSent) {
    const done = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts WHERE finished_at IS NOT NULL');
    if (done?.n && (await post('/ref/active', { installId: id }))) next = { ...next, activeSent: true };
  }
  if (next !== state) await saveRecord(db, STATE, next);
}
