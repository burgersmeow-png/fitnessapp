import type { Muscle } from './types';

export type CardioType = 'run' | 'walk' | 'ride' | 'row' | 'swim' | 'elliptical' | 'intervals';

export interface CardioKind {
  type: CardioType;
  label: string;
  /** Icon name from components/Icon. */
  icon: 'run' | 'walk' | 'ride' | 'row' | 'swim' | 'elliptical' | 'intervals';
  /** How much each muscle works, 0 to 1. */
  load: Partial<Record<Muscle, number>>;
  hasDistance: boolean;
}

export const CARDIO_KINDS: CardioKind[] = [
  { type: 'run', label: 'Run', icon: 'run', hasDistance: true, load: { quads: 1, hamstrings: 0.8, calves: 1, glutes: 0.7, core: 0.3 } },
  { type: 'walk', label: 'Walk', icon: 'walk', hasDistance: true, load: { calves: 0.5, quads: 0.3, glutes: 0.3 } },
  { type: 'ride', label: 'Ride', icon: 'ride', hasDistance: true, load: { quads: 1, glutes: 0.6, calves: 0.4, hamstrings: 0.4 } },
  { type: 'row', label: 'Row', icon: 'row', hasDistance: true, load: { back: 0.9, quads: 0.7, glutes: 0.5, biceps: 0.4, hamstrings: 0.4, core: 0.4 } },
  { type: 'swim', label: 'Swim', icon: 'swim', hasDistance: true, load: { back: 0.8, shoulders: 0.9, triceps: 0.4, core: 0.4 } },
  { type: 'elliptical', label: 'Elliptical', icon: 'elliptical', hasDistance: false, load: { quads: 0.6, glutes: 0.5, calves: 0.4 } },
  { type: 'intervals', label: 'Intervals', icon: 'intervals', hasDistance: false, load: { quads: 0.9, glutes: 0.7, hamstrings: 0.6, calves: 0.6, core: 0.6, shoulders: 0.4 } },
];

export const CARDIO_BY_TYPE = new Map(CARDIO_KINDS.map((k) => [k.type, k]));

export interface CardioSession {
  id?: number;
  type: CardioType;
  startedAt: string;
  minutes: number;
  distance: number | null;
  /** Effort from 1 (very easy) to 10 (all out). */
  rpe: number;
}

export interface FatigueEvent {
  muscle: Muscle;
  /** Fatigue in "hard set" units, the same scale lifting uses. */
  amount: number;
  completedAt: string;
}

/**
 * Converts cardio into muscle fatigue on the lifting scale.
 * 30 minutes at RPE 7 on a fully loaded muscle counts like about 3 hard sets.
 */
export function cardioFatigue(sessions: CardioSession[]): FatigueEvent[] {
  const events: FatigueEvent[] = [];
  for (const s of sessions) {
    const kind = CARDIO_BY_TYPE.get(s.type);
    if (!kind) continue;
    const dose = (s.minutes / 30) * (s.rpe / 7) * 3;
    for (const [muscle, share] of Object.entries(kind.load) as [Muscle, number][]) {
      events.push({ muscle, amount: dose * share, completedAt: s.startedAt });
    }
  }
  return events;
}

export const EFFORTS = [
  { rpe: 3, label: 'Easy' },
  { rpe: 5, label: 'Moderate' },
  { rpe: 7, label: 'Hard' },
  { rpe: 9, label: 'All out' },
];
