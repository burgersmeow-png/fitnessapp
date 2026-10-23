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

/** Best estimated 1RM per training day for one exercise, newest first. */
export function sessionBests(history: LoggedSet[], exerciseId: string): { day: string; e1rm: number; weight: number }[] {
  const byDay = new Map<string, { e1rm: number; weight: number }>();
  for (const s of history) {
    if (s.exerciseId !== exerciseId || s.weight <= 0 || s.reps <= 0) continue;
    const day = s.completedAt.slice(0, 10);
    const e1rm = estimate1RM(s.weight, s.reps, s.rir);
    const current = byDay.get(day);
    if (!current || e1rm > current.e1rm) byDay.set(day, { e1rm, weight: s.weight });
  }
  return [...byDay.entries()]
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

/** Only sessions this close to the latest one count toward the trend. */
const TREND_WINDOW_DAYS = 21;

/**
 * The 1RM to program from. A weighted average of the last three sessions
 * (3:2:1, newest heaviest) so one bad day doesn't tank the next workout,
 * but a new best is used straight away so progress shows up immediately.
 */
export function trainingMax(history: LoggedSet[], exerciseId: string): number | null {
  const all = sessionBests(history, exerciseId);
  if (all.length === 0) return null;
  // Sessions from before a long break no longer reflect current strength.
  const cutoff = Date.parse(all[0].day) - TREND_WINDOW_DAYS * 864e5;
  const bests = all.filter((b) => Date.parse(b.day) >= cutoff).slice(0, 3);
  const weights = [3, 2, 1];
  const total = bests.reduce((sum, b, i) => sum + b.e1rm * weights[i], 0);
  const average = total / weights.slice(0, bests.length).reduce((a, b) => a + b, 0);
  return Math.max(bests[0].e1rm, average);
}

export type LiftStatus = 'new' | 'progressing' | 'stalled';

/**
 * A lift is stalled when the best of the last three sessions hasn't beaten
 * the best of the sessions before them by at least 1%.
 */
export function liftStatus(history: LoggedSet[], exerciseId: string): LiftStatus {
  const bests = sessionBests(history, exerciseId);
  if (bests.length === 0) return 'new';
  if (bests.length < 5) return 'progressing';
  const recent = Math.max(...bests.slice(0, 3).map((b) => b.e1rm));
  const before = Math.max(...bests.slice(3, 8).map((b) => b.e1rm));
  return recent <= before * 1.01 ? 'stalled' : 'progressing';
}

/** How much lighter a deload session is. */
export const DELOAD_FACTOR = 0.9;

export interface WeightSuggestion {
  weight: number | null;
  status: LiftStatus;
  deload: boolean;
  /** Change from the heaviest weight used last session, when there is one. */
  change: number | null;
}

/**
 * Suggests a working weight for the next session: the weight that should hit
 * `targetReps` with `targetRir` in reserve at the current training max. When
 * sets beat their target, the training max rises and so does the suggestion;
 * that is the progressive overload. A stalled lift gets a lighter deload session.
 */
export function suggestNext(
  history: LoggedSet[],
  exerciseId: string,
  targetReps: number,
  targetRir: number,
  increment = 5,
): WeightSuggestion {
  const status = liftStatus(history, exerciseId);
  const max = trainingMax(history, exerciseId);
  if (max == null) return { weight: null, status, deload: false, change: null };
  const deload = status === 'stalled';
  const raw = weightFor1RM(max, targetReps, targetRir) * (deload ? DELOAD_FACTOR : 1);
  const weight = Math.max(increment, roundTo(raw, increment));
  const last = sessionBests(history, exerciseId)[0];
  return { weight, status, deload, change: last ? weight - last.weight : null };
}

export function suggestWeight(
  history: LoggedSet[],
  exerciseId: string,
  targetReps: number,
  targetRir: number,
  increment = 5,
): number | null {
  return suggestNext(history, exerciseId, targetReps, targetRir, increment).weight;
}

/**
 * Adjusts the weight for the rest of today's sets after a set is logged.
 * If the set was easier or harder than planned, recompute the weight that
 * should hit the target from what the lifter actually did. Returns null when
 * no change of at least one increment is needed.
 */
export function adjustNextSet(
  done: { weight: number; reps: number; rir: number | null },
  targetReps: number,
  targetRir: number,
  increment = 5,
): number | null {
  if (done.weight <= 0 || done.reps <= 0) return null;
  // Without an RIR rating, assume the set was on target unless reps were well off.
  const rir = done.rir ?? (Math.abs(done.reps - targetReps) >= 2 ? 0 : targetRir);
  const ideal = roundTo(weightFor1RM(estimate1RM(done.weight, done.reps, rir), targetReps, targetRir), increment);
  if (Math.abs(ideal - done.weight) < increment) return null;
  // Change by at most 10% within a session to stay safe.
  const capped = Math.min(done.weight * 1.1, Math.max(done.weight * 0.9, ideal));
  const next = roundTo(capped, increment);
  return next === done.weight ? null : next;
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
