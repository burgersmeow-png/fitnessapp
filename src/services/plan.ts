import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import { advancePlan, followPlan, type FollowedPlan, type PlanLink } from '../lib/planLink';

const KEY = 'followed-plan';
/** The workout started from the plan's next day, so finishing it moves the plan on. */
const WORKOUT_KEY = 'followed-plan:workout';

export const loadPlan = (db: SQLiteDatabase) => loadRecord<FollowedPlan>(db, KEY);

export async function startFollowing(db: SQLiteDatabase, plan: PlanLink): Promise<void> {
  await saveRecord(db, KEY, followPlan(plan));
  await saveRecord(db, WORKOUT_KEY, null);
}

export async function stopFollowing(db: SQLiteDatabase): Promise<void> {
  await saveRecord(db, KEY, null);
  await saveRecord(db, WORKOUT_KEY, null);
}

export const rememberPlanWorkout = (db: SQLiteDatabase, workoutId: number) => saveRecord(db, WORKOUT_KEY, workoutId);

/** Call when a workout is finished with sets logged. Moves the plan on if this was its day. */
export async function finishPlanWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  const [pending, plan] = await Promise.all([loadRecord<number>(db, WORKOUT_KEY), loadPlan(db)]);
  if (pending !== workoutId) return;
  await saveRecord(db, WORKOUT_KEY, null);
  if (plan) await saveRecord(db, KEY, advancePlan(plan));
}
