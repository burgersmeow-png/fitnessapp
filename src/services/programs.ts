import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, loadSettings, saveRecord, saveSettings } from '../lib/db';
import { PROGRAM_BY_ID, type ProgramState } from '../lib/programs';

const KEY = 'program';
/** The workout started from today's program session, so finishing it moves the program on. */
const WORKOUT_KEY = 'program:workout';

export const loadProgram = (db: SQLiteDatabase) => loadRecord<ProgramState>(db, KEY);

/** Starts (or restarts) a program and sets the weekly goal, and goal if it has one, to match. */
export async function startProgram(db: SQLiteDatabase, id: string): Promise<void> {
  const program = PROGRAM_BY_ID.get(id);
  if (!program) return;
  await saveRecord(db, KEY, { id, startedAt: new Date().toISOString(), sessionsDone: 0 } satisfies ProgramState);
  const settings = await loadSettings(db);
  await saveSettings(db, { ...settings, weeklyGoal: program.daysPerWeek, goal: program.goal ?? settings.goal });
}

export async function stopProgram(db: SQLiteDatabase): Promise<void> {
  await saveRecord(db, KEY, null);
  await saveRecord(db, WORKOUT_KEY, null);
}

export const rememberProgramWorkout = (db: SQLiteDatabase, workoutId: number) => saveRecord(db, WORKOUT_KEY, workoutId);

/** Call when a workout is finished with sets logged. Moves the program on if this was its session. */
export async function finishProgramWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  const [pending, state] = await Promise.all([loadRecord<number>(db, WORKOUT_KEY), loadProgram(db)]);
  if (pending !== workoutId) return;
  await saveRecord(db, WORKOUT_KEY, null);
  if (state) await saveRecord(db, KEY, { ...state, sessionsDone: state.sessionsDone + 1 });
}
