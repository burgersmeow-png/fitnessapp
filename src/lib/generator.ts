import type { FatigueEvent } from './cardio';
import { rotationHours, type ExercisePrefs } from './exercisePrefs';
import { suggestNext } from './progression';
import type { Equipment, Exercise, Goal, LoggedSet, Muscle, PlannedExercise, Settings } from './types';
import { ALL_MUSCLES } from './types';

/** Hours for a muscle to fully recover from a hard session. */
export const RECOVERY_HOURS = 72;
/** Weighted sets in the recovery window at which a muscle counts as fully fatigued. */
const FATIGUE_CAP = 12;

/**
 * How recovered each muscle is, from 0 (just trained hard) to 1 (fully fresh).
 * Each recent set adds fatigue to its primary muscles (1.0) and secondary
 * muscles (0.5), fading linearly to zero over RECOVERY_HOURS.
 */
export function muscleRecovery(
  history: LoggedSet[],
  exercises: Map<string, Exercise>,
  now: Date,
  extra: FatigueEvent[] = [],
): Record<Muscle, number> {
  const fatigue = Object.fromEntries(ALL_MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  const fadeAt = (iso: string) => {
    const hours = (now.getTime() - new Date(iso).getTime()) / 36e5;
    return hours < 0 || hours >= RECOVERY_HOURS ? 0 : 1 - hours / RECOVERY_HOURS;
  };
  for (const set of history) {
    const exercise = exercises.get(set.exerciseId);
    if (!exercise) continue;
    const fade = fadeAt(set.completedAt);
    for (const m of exercise.primary) fatigue[m] += fade;
    for (const m of exercise.secondary) fatigue[m] += 0.5 * fade;
  }
  // Cardio and anything else that tires muscles outside lifting.
  for (const e of extra) fatigue[e.muscle] += e.amount * fadeAt(e.completedAt);
  const recovery = {} as Record<Muscle, number>;
  for (const m of ALL_MUSCLES) recovery[m] = Math.max(0, 1 - fatigue[m] / FATIGUE_CAP);
  return recovery;
}

/** When options are otherwise equal, prefer equipment that loads well and tracks progress clearly. */
const EQUIPMENT_PREFERENCE: Record<Equipment, number> = {
  barbell: 6, dumbbell: 5, cable: 4, machine: 3, kettlebell: 2, bodyweight: 1, bands: 0,
};

interface Prescription {
  sets: number;
  reps: number;
  rir: number;
  rest: number;
}

export function prescription(goal: Goal, compound: boolean): Prescription {
  switch (goal) {
    case 'strength':
      return compound
        ? { sets: 5, reps: 5, rir: 2, rest: 180 }
        : { sets: 3, reps: 8, rir: 2, rest: 90 };
    case 'endurance':
      return { sets: 3, reps: 15, rir: 3, rest: 45 };
    case 'hypertrophy':
    default:
      return compound
        ? { sets: 3, reps: 8, rir: 2, rest: 120 }
        : { sets: 3, reps: 12, rir: 1, rest: 75 };
  }
}

/** Roughly how many exercises fit in the session length. */
export function exerciseCount(minutes: number): number {
  return Math.min(8, Math.max(3, Math.round(minutes / 9)));
}

/** Hours since the exercise was last done, or Infinity if never. */
function hoursSince(history: LoggedSet[], exerciseId: string, now: Date): number {
  let latest = -Infinity;
  for (const s of history) {
    if (s.exerciseId !== exerciseId) continue;
    latest = Math.max(latest, new Date(s.completedAt).getTime());
  }
  return latest === -Infinity ? Infinity : (now.getTime() - latest) / 36e5;
}

export interface GeneratedWorkout {
  focus: Muscle[];
  exercises: PlannedExercise[];
  recovery: Record<Muscle, number>;
}

/**
 * Builds today's workout.
 *
 * 1. Rank muscles by recovery and pick the freshest ones as today's focus.
 * 2. For each focus muscle, pick an exercise the user has equipment for:
 *    compounds first, preferring exercises not done recently so the plan rotates.
 *    "Suggest more" lifts come round sooner; "don't suggest" lifts are left out.
 * 3. Set sets, reps and rest from the goal, and the weight from progression.
 */
export function generateWorkout(
  exercises: Exercise[],
  history: LoggedSet[],
  settings: Settings,
  now: Date = new Date(),
  extraFatigue: FatigueEvent[] = [],
  /** Muscles to train regardless of recovery, e.g. from a spoken request. */
  focusOverride: Muscle[] = [],
  prefs: ExercisePrefs = {},
): GeneratedWorkout {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const recovery = muscleRecovery(history, byId, now, extraFatigue);
  const available = exercises.filter((e) => settings.equipment.includes(e.equipment) && prefs[e.id] !== 'never');
  const count = exerciseCount(settings.minutes);

  // Small muscles shouldn't lead a session, so big muscles win ties.
  const size: Record<Muscle, number> = {
    quads: 3, back: 3, chest: 3, hamstrings: 2, glutes: 2, shoulders: 2,
    biceps: 1, triceps: 1, calves: 0, core: 0,
  };
  const ranked = [...ALL_MUSCLES]
    .filter((m) => available.some((e) => e.primary.includes(m)))
    .sort((a, b) => recovery[b] - recovery[a] || size[b] - size[a]);

  // Only train muscles that are at least 60% recovered, but always plan something.
  // A requested focus wins, freshest of those muscles first.
  const ready = ranked.filter((m) => recovery[m] >= 0.6);
  const requested = ranked.filter((m) => focusOverride.includes(m));
  const pool = requested.length > 0 ? requested : ready.length >= 2 ? ready : ranked;

  const chosen: Exercise[] = [];
  const focus: Muscle[] = [];
  let round = 0;
  while (chosen.length < count && round < 3) {
    for (const muscle of pool) {
      if (chosen.length >= count) break;
      const candidates = available
        .filter((e) => e.primary.includes(muscle) && !chosen.includes(e))
        // Second-round picks for a muscle should be isolation work.
        .filter((e) => round === 0 || !e.compound)
        .sort(
          (a, b) =>
            Number(b.compound) - Number(a.compound) ||
            rotationHours(hoursSince(history, b.id, now), prefs[b.id]) - rotationHours(hoursSince(history, a.id, now), prefs[a.id]) ||
            EQUIPMENT_PREFERENCE[b.equipment] - EQUIPMENT_PREFERENCE[a.equipment] ||
            a.name.localeCompare(b.name),
        );
      const pick = candidates[0];
      if (!pick) continue;
      chosen.push(pick);
      if (!focus.includes(muscle)) focus.push(muscle);
    }
    round++;
    // Revisit only the top focus muscles for extra volume.
    pool.splice(Math.max(2, Math.ceil(pool.length / 2)));
  }

  // Compounds first, while the lifter is fresh.
  chosen.sort((a, b) => Number(b.compound) - Number(a.compound));

  const increment = settings.units === 'kg' ? 2.5 : 5;
  return {
    focus,
    recovery,
    exercises: chosen.map((e) => {
      const p = prescription(settings.goal, e.compound);
      const next = suggestNext(history, e.id, p.reps, p.rir, increment);
      const bodyweight = e.equipment === 'bodyweight';
      return {
        exerciseId: e.id,
        // A deload also trims a set to shed fatigue.
        sets: next.deload ? Math.max(2, p.sets - 1) : p.sets,
        targetReps: p.reps,
        targetRir: p.rir,
        suggestedWeight: bodyweight ? null : next.weight,
        restSeconds: p.rest,
        status: next.status,
        deload: next.deload,
        change: bodyweight ? null : next.change,
      };
    }),
  };
}
