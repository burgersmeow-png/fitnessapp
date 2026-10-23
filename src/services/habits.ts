import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import { BADGES, bestStreak, countPrs, dayKey, earnedBadges, type Badge, type HabitStats } from '../lib/habits';

/** When each badge was earned, and whether the user has seen it celebrated yet. */
type Earned = Record<string, { at: string; seen: boolean }>;
const KEY = 'badges';

/** Start times of every finished workout and cardio session. */
export async function loadSessionDates(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ at: string }>(
    `SELECT started_at AS at FROM workouts WHERE finished_at IS NOT NULL
     UNION ALL SELECT started_at AS at FROM cardio`,
  );
  return rows.map((r) => r.at);
}

export async function loadHabitStats(db: SQLiteDatabase, weeklyGoal: number): Promise<HabitStats> {
  const [workouts, cardio, sets, food] = await Promise.all([
    db.getAllAsync<{ at: string }>('SELECT started_at AS at FROM workouts WHERE finished_at IS NOT NULL'),
    db.getAllAsync<{ at: string }>('SELECT started_at AS at FROM cardio'),
    // Weights are stored in kg.
    db.getAllAsync<{ exerciseId: string; weight: number; reps: number; rir: number | null; completedAt: string }>(
      `SELECT s.exercise_id AS exerciseId, COALESCE(s.weight, 0) AS weight, COALESCE(s.reps, 0) AS reps, s.rir, s.completed_at AS completedAt
       FROM sets s JOIN workouts w ON w.id = s.workout_id
       WHERE s.completed_at IS NOT NULL AND w.finished_at IS NOT NULL`,
    ),
    db.getAllAsync<{ at: string }>('SELECT eaten_at AS at FROM food'),
  ]);
  return {
    workouts: workouts.length,
    cardio: cardio.length,
    prs: countPrs(sets),
    volumeKg: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    foodDays: new Set(food.map((f) => dayKey(new Date(f.at)))).size,
    bestStreak: bestStreak([...workouts, ...cardio].map((r) => r.at), weeklyGoal),
  };
}

export interface BadgeState {
  stats: HabitStats;
  earned: Earned;
  /** Earned but not yet celebrated, in the order of BADGES. */
  fresh: Badge[];
}

/** Works out which badges are earned, saving any new ones. Badges are never taken away. */
export async function checkBadges(db: SQLiteDatabase, weeklyGoal: number): Promise<BadgeState> {
  const [stats, saved] = await Promise.all([loadHabitStats(db, weeklyGoal), loadRecord<Earned>(db, KEY)]);
  const earned: Earned = { ...saved };
  let changed = false;
  for (const id of earnedBadges(stats)) {
    if (earned[id]) continue;
    earned[id] = { at: new Date().toISOString(), seen: false };
    changed = true;
  }
  if (changed) await saveRecord(db, KEY, earned);
  return { stats, earned, fresh: BADGES.filter((b) => earned[b.id] && !earned[b.id].seen) };
}

export async function markBadgesSeen(db: SQLiteDatabase): Promise<void> {
  const earned = (await loadRecord<Earned>(db, KEY)) ?? {};
  if (Object.values(earned).every((e) => e.seen)) return;
  await saveRecord(db, KEY, Object.fromEntries(Object.entries(earned).map(([id, e]) => [id, { ...e, seen: true }])));
}
