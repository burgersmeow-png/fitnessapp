import type { SQLiteDatabase } from 'expo-sqlite';
import { challengeProgress, type ChallengeDef, type ChallengeProgress, type JoinedChallenge } from '../lib/challenge';
import { loadRecord, saveRecord } from '../lib/db';
import { dayKey } from '../lib/habits';

const KEY = 'challenge';

export const loadChallenge = (db: SQLiteDatabase) => loadRecord<JoinedChallenge>(db, KEY);

export async function joinChallenge(db: SQLiteDatabase, def: ChallengeDef): Promise<JoinedChallenge> {
  const joined = { ...def, start: dayKey(new Date()) };
  await saveRecord(db, KEY, joined);
  return joined;
}

export const leaveChallenge = (db: SQLiteDatabase) => saveRecord(db, KEY, null);

/** The challenge, if this workout just won it. Marks it so the moment shows once. */
export async function freshWin(db: SQLiteDatabase, sessionDates: string[]): Promise<{ challenge: JoinedChallenge; progress: ChallengeProgress } | null> {
  const c = await loadChallenge(db);
  if (!c || c.celebrated) return null;
  const progress = challengeProgress(c, sessionDates, new Date());
  if (progress.status !== 'won') return null;
  await saveRecord(db, KEY, { ...c, celebrated: true });
  return { challenge: c, progress };
}
