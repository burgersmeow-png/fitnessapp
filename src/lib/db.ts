import type { SQLiteDatabase } from 'expo-sqlite';
import type { CardioSession, CardioType } from './cardio';
import { EXERCISES } from './exercises';
import type { Exercise, LoggedSet, PlannedExercise, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

export const DATABASE_NAME = 'liftlab.db';
const SCHEMA_VERSION = 2;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        equipment TEXT NOT NULL,
        primary_muscles TEXT NOT NULL,
        secondary_muscles TEXT NOT NULL,
        compound INTEGER NOT NULL,
        custom INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        position INTEGER NOT NULL,
        target_reps INTEGER,
        target_rir INTEGER,
        rest_seconds INTEGER NOT NULL DEFAULT 90,
        weight REAL,
        reps INTEGER,
        rir INTEGER,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS sets_exercise ON sets(exercise_id, completed_at);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }
  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cardio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        started_at TEXT NOT NULL,
        minutes REAL NOT NULL,
        distance REAL,
        rpe INTEGER NOT NULL
      );
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  await seedExercises(db);
}

async function seedExercises(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const e of EXERCISES) {
      await db.runAsync(
        `INSERT INTO exercises (id, name, equipment, primary_muscles, secondary_muscles, compound)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, equipment = excluded.equipment,
           primary_muscles = excluded.primary_muscles, secondary_muscles = excluded.secondary_muscles,
           compound = excluded.compound`,
        e.id, e.name, e.equipment, JSON.stringify(e.primary), JSON.stringify(e.secondary), e.compound ? 1 : 0,
      );
    }
  });
}

interface ExerciseRow {
  id: string;
  name: string;
  equipment: string;
  primary_muscles: string;
  secondary_muscles: string;
  compound: number;
}

export async function loadExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY name');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    equipment: r.equipment as Exercise['equipment'],
    primary: JSON.parse(r.primary_muscles),
    secondary: JSON.parse(r.secondary_muscles),
    compound: r.compound === 1,
  }));
}

export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'settings'");
  return row ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } : DEFAULT_SETTINGS;
}

export async function saveSettings(db: SQLiteDatabase, settings: Settings): Promise<void> {
  await db.runAsync(
    "INSERT INTO settings (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    JSON.stringify(settings),
  );
}

/** Completed sets, newest first. `sinceDays` limits how far back to look. */
export async function loadHistory(db: SQLiteDatabase, sinceDays?: number): Promise<LoggedSet[]> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 864e5).toISOString() : '';
  const rows = await db.getAllAsync<{
    exercise_id: string;
    weight: number | null;
    reps: number | null;
    rir: number | null;
    completed_at: string;
  }>(
    `SELECT exercise_id, weight, reps, rir, completed_at FROM sets
     WHERE completed_at IS NOT NULL AND completed_at >= ? ORDER BY completed_at DESC`,
    since,
  );
  return rows.map((r) => ({
    exerciseId: r.exercise_id,
    weight: r.weight ?? 0,
    reps: r.reps ?? 0,
    rir: r.rir,
    completedAt: r.completed_at,
  }));
}

export async function activeWorkoutId(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM workouts WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1',
  );
  return row?.id ?? null;
}

/** Saves a planned workout as pending sets and returns the new workout id. */
export async function startWorkout(db: SQLiteDatabase, plan: PlannedExercise[]): Promise<number> {
  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('INSERT INTO workouts (started_at) VALUES (?)', new Date().toISOString());
    workoutId = result.lastInsertRowId;
    let position = 0;
    for (const p of plan) {
      for (let i = 0; i < p.sets; i++) {
        await db.runAsync(
          `INSERT INTO sets (workout_id, exercise_id, position, target_reps, target_rir, rest_seconds, weight, reps)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          workoutId, p.exerciseId, position++, p.targetReps, p.targetRir, p.restSeconds, p.suggestedWeight, p.targetReps,
        );
      }
    }
  });
  return workoutId;
}

export interface WorkoutSet {
  id: number;
  exerciseId: string;
  position: number;
  targetReps: number | null;
  targetRir: number | null;
  restSeconds: number;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  completedAt: string | null;
}

export async function loadWorkoutSets(db: SQLiteDatabase, workoutId: number): Promise<WorkoutSet[]> {
  const rows = await db.getAllAsync<{
    id: number;
    exercise_id: string;
    position: number;
    target_reps: number | null;
    target_rir: number | null;
    rest_seconds: number;
    weight: number | null;
    reps: number | null;
    rir: number | null;
    completed_at: string | null;
  }>('SELECT * FROM sets WHERE workout_id = ? ORDER BY position', workoutId);
  return rows.map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    position: r.position,
    targetReps: r.target_reps,
    targetRir: r.target_rir,
    restSeconds: r.rest_seconds,
    weight: r.weight,
    reps: r.reps,
    rir: r.rir,
    completedAt: r.completed_at,
  }));
}

export async function updateSet(
  db: SQLiteDatabase,
  id: number,
  fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rir' | 'completedAt'>>,
): Promise<void> {
  const columns: Record<string, string> = { weight: 'weight', reps: 'reps', rir: 'rir', completedAt: 'completed_at' };
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return;
  await db.runAsync(
    `UPDATE sets SET ${keys.map((k) => `${columns[k]} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map((k) => fields[k] ?? null),
    id,
  );
}

export async function addSet(db: SQLiteDatabase, workoutId: number, after: WorkoutSet): Promise<void> {
  await db.runAsync('UPDATE sets SET position = position + 1 WHERE workout_id = ? AND position > ?', workoutId, after.position);
  await db.runAsync(
    `INSERT INTO sets (workout_id, exercise_id, position, target_reps, target_rir, rest_seconds, weight, reps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    workoutId, after.exerciseId, after.position + 1, after.targetReps, after.targetRir, after.restSeconds, after.weight, after.reps,
  );
}

/** Ends the workout, dropping sets that were never completed. Deletes it if nothing was logged. */
export async function finishWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sets WHERE workout_id = ? AND completed_at IS NULL', workoutId);
    const left = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sets WHERE workout_id = ?', workoutId);
    if (!left?.n) {
      await db.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    } else {
      await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', new Date().toISOString(), workoutId);
    }
  });
}

export interface WorkoutSummary {
  id: number;
  startedAt: string;
  finishedAt: string;
  sets: number;
  volume: number;
  exercises: string;
}

export async function loadWorkouts(db: SQLiteDatabase): Promise<WorkoutSummary[]> {
  return db.getAllAsync<WorkoutSummary>(
    `SELECT w.id, w.started_at AS startedAt, w.finished_at AS finishedAt,
            COUNT(s.id) AS sets, COALESCE(SUM(s.weight * s.reps), 0) AS volume,
            GROUP_CONCAT(DISTINCT e.name) AS exercises
     FROM workouts w
     JOIN sets s ON s.workout_id = w.id
     JOIN exercises e ON e.id = s.exercise_id
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id ORDER BY w.started_at DESC`,
  );
}

export async function saveCardio(db: SQLiteDatabase, c: CardioSession): Promise<void> {
  await db.runAsync(
    'INSERT INTO cardio (type, started_at, minutes, distance, rpe) VALUES (?, ?, ?, ?, ?)',
    c.type, c.startedAt, c.minutes, c.distance, c.rpe,
  );
}

/** Cardio sessions, newest first. `sinceDays` limits how far back to look. */
export async function loadCardio(db: SQLiteDatabase, sinceDays?: number): Promise<CardioSession[]> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 864e5).toISOString() : '';
  const rows = await db.getAllAsync<{ id: number; type: string; started_at: string; minutes: number; distance: number | null; rpe: number }>(
    'SELECT * FROM cardio WHERE started_at >= ? ORDER BY started_at DESC',
    since,
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as CardioType,
    startedAt: r.started_at,
    minutes: r.minutes,
    distance: r.distance,
    rpe: r.rpe,
  }));
}
