import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import { cleanPrefs, setPref, type ExercisePref, type ExercisePrefs } from '../lib/exercisePrefs';

const KEY = 'exercise-prefs';

export const loadPrefs = async (db: SQLiteDatabase): Promise<ExercisePrefs> => cleanPrefs(await loadRecord(db, KEY));

export async function savePref(db: SQLiteDatabase, exerciseId: string, pref: ExercisePref | null): Promise<void> {
  await saveRecord(db, KEY, setPref(await loadPrefs(db), exerciseId, pref));
}
