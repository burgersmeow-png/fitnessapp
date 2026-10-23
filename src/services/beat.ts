import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import type { BeatTarget } from '../lib/workoutLink';

export interface Dare {
  title: string;
  target: BeatTarget;
  /** The creator's name, when the link carried their code. */
  who: string | null;
}

const key = (workoutId: number) => `beat:${workoutId}`;

/** Remembers that this workout was started from a "beat my workout" link. */
export const armDare = (db: SQLiteDatabase, workoutId: number, dare: Dare) => saveRecord(db, key(workoutId), dare);

/** The dare for a finished workout, once: it is cleared as it is read. */
export async function takeDare(db: SQLiteDatabase, workoutId: number): Promise<Dare | null> {
  const dare = await loadRecord<Dare>(db, key(workoutId));
  if (dare) await saveRecord(db, key(workoutId), null);
  return dare;
}
