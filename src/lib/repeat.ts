// Turning a past workout into today's plan, and grouping its sets for display. Pure.
import { suggestNext } from './progression';
import type { LoggedSet, PlannedExercise } from './types';

export interface PastSet {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  rir: number | null;
  targetReps: number | null;
  targetRir: number | null;
  restSeconds: number;
}

/** Consecutive sets of the same lift, in the order they were done. */
export function groupSets<T extends { exerciseId: string }>(sets: T[]): { exerciseId: string; sets: T[] }[] {
  const out: { exerciseId: string; sets: T[] }[] = [];
  for (const s of sets) {
    const last = out.at(-1);
    if (last && last.exerciseId === s.exerciseId) last.sets.push(s);
    else out.push({ exerciseId: s.exerciseId, sets: [s] });
  }
  return out;
}

/**
 * The same lifts, set counts, reps and rests as a past workout, with today's weights from
 * progression (so it moves forward rather than copying old numbers). A lift done in two
 * separate blocks is planned once, with all its sets.
 */
export function repeatPlan(past: PastSet[], history: LoggedSet[], increment: number): PlannedExercise[] {
  const byLift = new Map<string, PastSet[]>();
  for (const s of past) byLift.set(s.exerciseId, [...(byLift.get(s.exerciseId) ?? []), s]);
  return [...byLift].map(([exerciseId, sets]) => {
    const first = sets[0];
    const targetReps = first.targetReps ?? first.reps ?? 8;
    const targetRir = first.targetRir ?? 2;
    const bodyweight = sets.every((s) => !s.weight);
    const next = suggestNext(history, exerciseId, targetReps, targetRir, increment);
    return {
      exerciseId,
      sets: next.deload ? Math.max(2, sets.length - 1) : sets.length,
      targetReps,
      targetRir,
      suggestedWeight: bodyweight ? null : next.weight ?? first.weight,
      restSeconds: first.restSeconds,
      status: next.status,
      deload: next.deload,
      change: bodyweight ? null : next.change,
    };
  });
}
