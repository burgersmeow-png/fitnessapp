import type { SQLiteDatabase } from 'expo-sqlite';
import type { CardioSession, CardioType } from './cardio';
import { EXERCISES } from './exercises';
import type { FoodEntry, FoodItem, Meal } from './nutrition';
import type { ExportRow } from './exportCsv';
import type { Exercise, LoggedSet, PlannedExercise, Settings } from './types';
import { DEFAULT_SETTINGS } from './types';

export const DATABASE_NAME = 'liftlab.db';
const SCHEMA_VERSION = 6;

/*
 * Units: weights are stored in kilograms and distances in kilometres. They are
 * converted at this boundary to whatever the user picked in Settings, so
 * switching between kg and lb never changes the underlying data.
 */
const LB_PER_KG = 2.20462262;
const MI_PER_KM = 0.621371192;
let units: Settings['units'] = DEFAULT_SETTINGS.units;

const round1 = (n: number) => Math.round(n * 10) / 10;
/** Stored kg to display units. */
export const fromKg = (kg: number) => round1(units === 'lb' ? kg * LB_PER_KG : kg);
/** The units picked in Settings, for labels next to converted numbers. */
export const displayUnits = () => ({ weight: units, distance: units === 'kg' ? 'km' : 'mi' }) as const;
/** Display units to stored kg. */
export const toKg = (w: number) => (units === 'lb' ? w / LB_PER_KG : w);
const fromKgOrNull = (kg: number | null) => (kg == null ? null : fromKg(kg));
const toKgOrNull = (w: number | null | undefined) => (w == null ? null : toKg(w));
/** Stored km to display units (km or mi). */
export const fromKm = (km: number | null) => (km == null ? null : round1(units === 'lb' ? km * MI_PER_KM : km));
/** Display units to stored km. */
export const toKm = (d: number | null) => (d == null ? null : units === 'lb' ? d / MI_PER_KM : d);

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
  if (version >= 1 && version < 3) {
    // Before v3, weights and distances were stored in the display unit.
    const saved = await loadSettings(db);
    if (saved.units === 'lb') {
      await db.runAsync('UPDATE sets SET weight = weight / ? WHERE weight IS NOT NULL', LB_PER_KG);
      await db.runAsync('UPDATE cardio SET distance = distance / ? WHERE distance IS NOT NULL', MI_PER_KM);
    }
  }
  if (version < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS food (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eaten_at TEXT NOT NULL,
        meal TEXT NOT NULL,
        name TEXT NOT NULL,
        portion TEXT NOT NULL,
        calories REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL,
        source TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS food_eaten ON food(eaten_at);
    `);
  }
  if (version < 5) {
    // Where an imported session came from (e.g. "strava:123"), so a sync never adds it twice.
    await db.execAsync(`
      ALTER TABLE cardio ADD COLUMN source_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS cardio_source ON cardio(source_id);
    `);
  }
  if (version < 6) {
    // Body weight over time, in kg. The latest reading also lives in settings for nutrition targets.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS body_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        measured_at TEXT NOT NULL,
        kg REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS body_weights_at ON body_weights(measured_at);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  await seedExercises(db);
  units = (await loadSettings(db)).units;
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
  custom: number;
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
    ...(r.custom ? { custom: true } : {}),
  }));
}

export async function saveCustomExercise(db: SQLiteDatabase, e: Exercise): Promise<void> {
  await db.runAsync(
    `INSERT INTO exercises (id, name, equipment, primary_muscles, secondary_muscles, compound, custom) VALUES (?, ?, ?, ?, ?, ?, 1)`,
    e.id, e.name, e.equipment, JSON.stringify(e.primary), JSON.stringify(e.secondary), e.compound ? 1 : 0,
  );
}

/** Removes a custom exercise if it was never logged. Returns false when sets still use it. */
export async function deleteCustomExercise(db: SQLiteDatabase, id: string): Promise<boolean> {
  const used = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sets WHERE exercise_id = ?', id);
  if (used?.n) return false;
  await db.runAsync('DELETE FROM exercises WHERE id = ? AND custom = 1', id);
  return true;
}

export async function loadSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'settings'");
  return row ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) } : DEFAULT_SETTINGS;
}

export async function saveSettings(db: SQLiteDatabase, settings: Settings): Promise<void> {
  units = settings.units;
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
    weight: r.weight == null ? 0 : fromKg(r.weight),
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
          workoutId, p.exerciseId, position++, p.targetReps, p.targetRir, p.restSeconds, toKgOrNull(p.suggestedWeight), p.targetReps,
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
    weight: fromKgOrNull(r.weight),
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
    ...keys.map((k) => (k === 'weight' ? toKgOrNull(fields.weight) : fields[k] ?? null)),
    id,
  );
}

export async function addSet(db: SQLiteDatabase, workoutId: number, after: WorkoutSet): Promise<void> {
  await db.runAsync('UPDATE sets SET position = position + 1 WHERE workout_id = ? AND position > ?', workoutId, after.position);
  await db.runAsync(
    `INSERT INTO sets (workout_id, exercise_id, position, target_reps, target_rir, rest_seconds, weight, reps)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    workoutId, after.exerciseId, after.position + 1, after.targetReps, after.targetRir, after.restSeconds, toKgOrNull(after.weight), after.reps,
  );
}

/** Moves the given (not yet done) sets to another exercise, with a fresh starting weight. */
export async function swapSets(db: SQLiteDatabase, setIds: number[], exerciseId: string, weight: number | null): Promise<void> {
  if (setIds.length === 0) return;
  await db.runAsync(
    `UPDATE sets SET exercise_id = ?, weight = ?, rir = NULL WHERE completed_at IS NULL AND id IN (${setIds.map(() => '?').join(', ')})`,
    exerciseId, toKgOrNull(weight), ...setIds,
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
  const rows = await db.getAllAsync<WorkoutSummary>(
    `SELECT w.id, w.started_at AS startedAt, w.finished_at AS finishedAt,
            COUNT(s.id) AS sets, COALESCE(SUM(s.weight * s.reps), 0) AS volume,
            GROUP_CONCAT(DISTINCT e.name) AS exercises
     FROM workouts w
     JOIN sets s ON s.workout_id = w.id
     JOIN exercises e ON e.id = s.exercise_id
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id ORDER BY w.started_at DESC`,
  );
  return rows.map((r) => ({ ...r, volume: fromKg(r.volume) }));
}

export async function loadWorkout(db: SQLiteDatabase, id: number): Promise<{ id: number; startedAt: string; finishedAt: string | null } | null> {
  return db.getFirstAsync('SELECT id, started_at AS startedAt, finished_at AS finishedAt FROM workouts WHERE id = ?', id);
}

export async function deleteWorkout(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sets WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
}

/** Every logged set, oldest first, with set numbers within each workout, for export. */
export async function loadExportRows(db: SQLiteDatabase): Promise<ExportRow[]> {
  const rows = await db.getAllAsync<{ workout_id: number; name: string; exercise_id: string; weight: number | null; reps: number | null; rir: number | null; completed_at: string }>(
    `SELECT s.workout_id, e.name, s.exercise_id, s.weight, s.reps, s.rir, s.completed_at
     FROM sets s JOIN exercises e ON e.id = s.exercise_id
     WHERE s.completed_at IS NOT NULL ORDER BY s.workout_id, s.position`,
  );
  const counts = new Map<string, number>();
  return rows.map((r) => {
    const key = `${r.workout_id}:${r.exercise_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return { date: r.completed_at, exercise: r.name, set: counts.get(key)!, weight: fromKgOrNull(r.weight), reps: r.reps, rir: r.rir };
  });
}

export async function saveCardio(db: SQLiteDatabase, c: CardioSession): Promise<void> {
  await db.runAsync(
    'INSERT INTO cardio (type, started_at, minutes, distance, rpe) VALUES (?, ?, ?, ?, ?)',
    c.type, c.startedAt, c.minutes, toKm(c.distance), c.rpe,
  );
}

/** Saves imported sessions (distance in km), skipping ones already saved. Returns how many were new. */
export async function importCardio(db: SQLiteDatabase, sessions: (CardioSession & { sourceId: string })[]): Promise<number> {
  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const c of sessions) {
      const r = await db.runAsync(
        'INSERT OR IGNORE INTO cardio (type, started_at, minutes, distance, rpe, source_id) VALUES (?, ?, ?, ?, ?, ?)',
        c.type, c.startedAt, c.minutes, c.distance, c.rpe, c.sourceId,
      );
      added += r.changes;
    }
  });
  return added;
}

/** Cardio sessions, newest first. `sinceDays` limits how far back to look. */
export async function loadCardio(db: SQLiteDatabase, sinceDays?: number): Promise<CardioSession[]> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 864e5).toISOString() : '';
  const rows = await db.getAllAsync<{ id: number; type: string; started_at: string; minutes: number; distance: number | null; rpe: number; source_id: string | null }>(
    'SELECT * FROM cardio WHERE started_at >= ? ORDER BY started_at DESC',
    since,
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as CardioType,
    startedAt: r.started_at,
    minutes: r.minutes,
    distance: fromKm(r.distance),
    rpe: r.rpe,
    source: r.source_id ? r.source_id.split(':')[0] : null,
  }));
}

/** Small app records kept beside the settings, such as the Strava sign-in. */
export async function loadRecord<T>(db: SQLiteDatabase, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function saveRecord(db: SQLiteDatabase, key: string, value: unknown | null): Promise<void> {
  if (value == null) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
    return;
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, JSON.stringify(value),
  );
}

export async function saveFood(
  db: SQLiteDatabase,
  items: FoodItem[],
  meal: Meal,
  source: FoodEntry['source'],
  eatenAt = new Date(),
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const i of items) {
      await db.runAsync(
        'INSERT INTO food (eaten_at, meal, name, portion, calories, protein, carbs, fat, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        eatenAt.toISOString(), meal, i.name, i.portion, i.calories, i.protein, i.carbs, i.fat, source,
      );
    }
  });
}

export async function deleteFood(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM food WHERE id = ?', id);
}

/** Everything eaten on the given local calendar day, oldest first. */
export async function loadFoodForDay(db: SQLiteDatabase, day: Date): Promise<FoodEntry[]> {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  const rows = await db.getAllAsync<{
    id: number; eaten_at: string; meal: string; name: string; portion: string;
    calories: number; protein: number; carbs: number; fat: number; source: string;
  }>('SELECT * FROM food WHERE eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at', start.toISOString(), end.toISOString());
  return rows.map((r) => ({
    id: r.id,
    eatenAt: r.eaten_at,
    meal: r.meal as Meal,
    name: r.name,
    portion: r.portion,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    source: r.source as FoodEntry['source'],
  }));
}

export interface BodyWeight {
  id: number;
  measuredAt: string;
  /** In the display unit. */
  weight: number;
}

/** Logs a weigh-in (display units) and makes it the body weight used for nutrition targets. */
export async function logBodyWeight(db: SQLiteDatabase, weight: number, at = new Date()): Promise<void> {
  const kg = Math.round(toKg(weight) * 100) / 100;
  await db.runAsync('INSERT INTO body_weights (measured_at, kg) VALUES (?, ?)', at.toISOString(), kg);
  const settings = await loadSettings(db);
  await saveSettings(db, { ...settings, bodyWeightKg: Math.round(kg * 10) / 10 });
}

export async function deleteBodyWeight(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM body_weights WHERE id = ?', id);
}

/** Weigh-ins, oldest first. `sinceDays` limits how far back to look. */
export async function loadBodyWeights(db: SQLiteDatabase, sinceDays?: number): Promise<BodyWeight[]> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 864e5).toISOString() : '';
  const rows = await db.getAllAsync<{ id: number; measured_at: string; kg: number }>(
    'SELECT * FROM body_weights WHERE measured_at >= ? ORDER BY measured_at',
    since,
  );
  return rows.map((r) => ({ id: r.id, measuredAt: r.measured_at, weight: fromKg(r.kg) }));
}
