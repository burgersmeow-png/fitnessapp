import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import { removeSaved, saveWorkout, type SavedWorkout } from '../lib/savedWorkouts';
import type { WorkoutLink } from '../lib/workoutLink';

const KEY = 'saved-workouts';

export const loadSaved = async (db: SQLiteDatabase): Promise<SavedWorkout[]> => (await loadRecord<SavedWorkout[]>(db, KEY)) ?? [];

export async function keepWorkout(db: SQLiteDatabase, link: WorkoutLink): Promise<SavedWorkout[]> {
  const list = saveWorkout(await loadSaved(db), link);
  await saveRecord(db, KEY, list);
  return list;
}

export async function forgetWorkout(db: SQLiteDatabase, id: string): Promise<SavedWorkout[]> {
  const list = removeSaved(await loadSaved(db), id);
  await saveRecord(db, KEY, list);
  return list;
}
