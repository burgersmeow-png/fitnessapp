import type { LoggedSet } from './types';

/** Estimated one-rep max using the Epley formula. */
export function estimate1RM(weight: number, reps: number, rir: number | null = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  const effectiveReps = reps + Math.max(0, rir ?? 0);
  if (effectiveReps <= 1) return weight;
  return weight * (1 + effectiveReps / 30);
}

/** Heaviest weight that should leave `rir` reps in reserve after `reps` reps. */
export function weightFor1RM(oneRM: number, reps: number, rir: number): number {
  const effectiveReps = reps + rir;
  if (effectiveReps <= 1) return oneRM;
  return oneRM / (1 + effectiveReps / 30);
}

export function roundTo(weight: number, increment: number): number {
  return Math.round(weight / increment) * increment;
}

/** Sets from the most recent session (calendar day) in which the exercise was trained. */
export function lastSession(history: LoggedSet[], exerciseId: string): LoggedSet[] {
  const sets = history
    .filter((s) => s.exerciseId === exerciseId && s.weight > 0 && s.reps > 0)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  if (sets.length === 0) return [];
  const day = sets[0].completedAt.slice(0, 10);
  return sets.filter((s) => s.completedAt.slice(0, 10) === day);
}

/**
 * Suggests a working weight for the next session.
 *
 * Uses the best estimated 1RM from the last session, then works backward to the
 * weight that should hit `targetReps` with `targetRir` in reserve. If every set
 * last time beat its target, the estimate already reflects that, so the
 * suggestion rises on its own: that is the progressive overload.
 */
export function suggestWeight(
  history: LoggedSet[],
  exerciseId: string,
  targetReps: number,
  targetRir: number,
  increment = 5,
): number | null {
  const sets = lastSession(history, exerciseId);
  if (sets.length === 0) return null;
  const best = Math.max(...sets.map((s) => estimate1RM(s.weight, s.reps, s.rir)));
  const suggested = roundTo(weightFor1RM(best, targetReps, targetRir), increment);
  return Math.max(increment, suggested);
}

export interface PersonalRecord {
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
  completedAt: string;
}

/** Best set by estimated 1RM for each exercise. */
export function personalRecords(history: LoggedSet[]): Map<string, PersonalRecord> {
  const prs = new Map<string, PersonalRecord>();
  for (const s of history) {
    const e1rm = estimate1RM(s.weight, s.reps, s.rir);
    const current = prs.get(s.exerciseId);
    if (!current || e1rm > current.e1rm) {
      prs.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        weight: s.weight,
        reps: s.reps,
        e1rm,
        completedAt: s.completedAt,
      });
    }
  }
  return prs;
}
