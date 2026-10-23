import type { SQLiteDatabase } from 'expo-sqlite';
import type { ChallengeDef, JoinedChallenge } from '../lib/challenge';
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
