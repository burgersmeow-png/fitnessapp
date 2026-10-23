// Personal records: each lift's bests and the PRs set over time. Pure.
import { dayKey } from './habits';
import { estimate1RM } from './progression';
import type { LoggedSet } from './types';

export interface LiftRecord {
  exerciseId: string;
  /** Best estimated 1-rep max and the set behind it; null for lifts only done without weight. */
  best: { e1rm: number; weight: number; reps: number; at: string } | null;
  heaviest: { weight: number; reps: number; at: string } | null;
  mostReps: { reps: number; weight: number; at: string };
  sets: number;
}

/** One record row per lift ever logged, strongest first, then by most reps. */
export function liftRecords(history: LoggedSet[]): LiftRecord[] {
  const byLift = new Map<string, LiftRecord>();
  for (const s of history) {
    if (s.reps <= 0) continue;
    const r = byLift.get(s.exerciseId) ?? {
      exerciseId: s.exerciseId,
      best: null,
      heaviest: null,
      mostReps: { reps: 0, weight: 0, at: s.completedAt },
      sets: 0,
    };
    r.sets++;
    if (s.weight > 0) {
      const e1rm = estimate1RM(s.weight, s.reps, s.rir);
      if (!r.best || e1rm > r.best.e1rm) r.best = { e1rm, weight: s.weight, reps: s.reps, at: s.completedAt };
      if (!r.heaviest || s.weight > r.heaviest.weight || (s.weight === r.heaviest.weight && s.reps > r.heaviest.reps)) {
        r.heaviest = { weight: s.weight, reps: s.reps, at: s.completedAt };
      }
    }
    if (s.reps > r.mostReps.reps || (s.reps === r.mostReps.reps && s.weight > r.mostReps.weight)) {
      r.mostReps = { reps: s.reps, weight: s.weight, at: s.completedAt };
    }
    byLift.set(s.exerciseId, r);
  }
  return [...byLift.values()].sort((a, b) => (b.best?.e1rm ?? 0) - (a.best?.e1rm ?? 0) || b.mostReps.reps - a.mostReps.reps);
}

export interface PrEvent {
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
  /** How much the estimated max went up. */
  gain: number;
  at: string;
}

/**
 * Every time a lift beat its previous best estimated max, newest first. The first session of a
 * lift sets the baseline rather than counting as a PR; several PR sets in one day count once.
 */
export function prHistory(history: LoggedSet[], limit = 20): PrEvent[] {
  const best = new Map<string, number>();
  const byDay = new Map<string, PrEvent>();
  const firstDay = new Map<string, string>();
  for (const s of [...history].sort((a, b) => a.completedAt.localeCompare(b.completedAt))) {
    if (s.weight <= 0 || s.reps <= 0) continue;
    const e1rm = estimate1RM(s.weight, s.reps, s.rir);
    const day = dayKey(new Date(s.completedAt));
    if (!firstDay.has(s.exerciseId)) firstDay.set(s.exerciseId, day);
    const prev = best.get(s.exerciseId);
    if (prev != null && e1rm > prev && firstDay.get(s.exerciseId) !== day) {
      const key = `${s.exerciseId}@${day}`;
      const base = byDay.get(key);
      byDay.set(key, { exerciseId: s.exerciseId, weight: s.weight, reps: s.reps, e1rm, gain: e1rm - (base ? base.e1rm - base.gain : prev), at: s.completedAt });
    }
    if (prev == null || e1rm > prev) best.set(s.exerciseId, e1rm);
  }
  return [...byDay.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
