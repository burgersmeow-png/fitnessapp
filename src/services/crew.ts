import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, loadSettings, saveRecord } from '../lib/db';
import { weekProgress } from '../lib/habits';
import { flushCreator, installId, loadCreator } from './creatorCode';
import { loadSessionDates } from './habits';
import { SERVER_URL } from './server';

const KEY = 'crew';

export interface CrewPlace {
  place: number;
  nickname: string;
  days: number;
  me: boolean;
}

export interface CrewBoard {
  creatorName: string;
  top: CrewPlace[];
  me: CrewPlace | null;
  /** Followers on the board with at least one day this week. */
  total: number;
}

/** The nickname this phone joined its creator's crew with, if it did. */
export const loadCrewName = async (db: SQLiteDatabase) => (await loadRecord<{ nickname: string }>(db, KEY))?.nickname ?? null;

async function call(db: SQLiteDatabase, action: string, extra: object = {}): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const res = await fetch(`${SERVER_URL}/ref/crew/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installId: await installId(db), ...extra }),
  });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const daysThisWeek = async (db: SQLiteDatabase) => {
  const [dates, settings] = await Promise.all([loadSessionDates(db), loadSettings(db)]);
  return weekProgress(dates, settings.weeklyGoal).done;
};

/** Joins the creator's weekly leaderboard. Returns a line to show when it didn't work. */
export async function joinCrew(db: SQLiteDatabase, nickname: string): Promise<string | null> {
  if (!SERVER_URL || !(await loadCreator(db))) return 'Add a creator code first.';
  try {
    await flushCreator(db);
    const r = await call(db, 'join', { nickname });
    if (!r.ok) return typeof r.body.error === 'string' ? r.body.error : 'Couldn’t join. Try again.';
    await saveRecord(db, KEY, { nickname: nickname.trim().replace(/\s+/g, ' ') });
    await syncCrew(db);
    return null;
  } catch {
    return 'No connection. Try again when you’re online.';
  }
}

export async function leaveCrew(db: SQLiteDatabase): Promise<void> {
  await saveRecord(db, KEY, null);
  if (SERVER_URL) await call(db, 'leave').catch(() => {});
}

/** Sends this week's training days. Quiet; called after workouts and when Today opens. */
export async function syncCrew(db: SQLiteDatabase): Promise<void> {
  if (!SERVER_URL || !(await loadCrewName(db))) return;
  await call(db, 'sync', { days: await daysThisWeek(db) }).catch(() => {});
}

/** This week's board for someone who joined; null otherwise or when offline. */
export async function loadCrewBoard(db: SQLiteDatabase): Promise<CrewBoard | null> {
  if (!SERVER_URL || !(await loadCrewName(db))) return null;
  try {
    await syncCrew(db);
    const r = await call(db, 'board');
    return r.ok ? (r.body as unknown as CrewBoard) : null;
  } catch {
    return null;
  }
}
