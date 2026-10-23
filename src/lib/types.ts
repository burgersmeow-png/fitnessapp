export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'bodyweight'
  | 'bands';

export type Goal = 'strength' | 'hypertrophy' | 'endurance';

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment;
  compound: boolean;
}

/** One logged set. `rir` is reps in reserve (0 = failure). */
export interface LoggedSet {
  exerciseId: string;
  weight: number;
  reps: number;
  rir: number | null;
  completedAt: string; // ISO timestamp
}

export interface Settings {
  goal: Goal;
  equipment: Equipment[];
  minutes: number;
  units: 'lb' | 'kg';
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  targetReps: number;
  targetRir: number;
  suggestedWeight: number | null;
  restSeconds: number;
}

export const ALL_MUSCLES: Muscle[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
];

export const ALL_EQUIPMENT: Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebell',
  'bodyweight',
  'bands',
];

export const DEFAULT_SETTINGS: Settings = {
  goal: 'hypertrophy',
  equipment: [...ALL_EQUIPMENT],
  minutes: 45,
  units: 'lb',
};
