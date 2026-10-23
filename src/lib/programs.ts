// Training programs: a fixed rotation of session types over a set number of weeks.
// The program picks what to train each day; the generator still picks exercises
// and weights from recovery and progression. Pure: storage is in src/services/programs.ts.
import type { GeneratedWorkout } from './generator';
import type { Goal, Muscle } from './types';

export interface ProgramDay {
  name: string;
  focus: Muscle[];
}

export interface Program {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  blurb: string;
  daysPerWeek: number;
  weeks: number;
  /** Every Nth week is lighter, to recover and come back stronger. */
  deloadEvery: number;
  /** Switches the training goal while following it, e.g. heavy low reps for strength. */
  goal?: Goal;
  days: ProgramDay[];
}

const UPPER: Muscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
const LOWER: Muscle[] = ['quads', 'hamstrings', 'glutes', 'calves', 'core'];

export const PROGRAMS: Program[] = [
  {
    id: 'full-body-3',
    name: 'Full Body',
    level: 'Beginner',
    blurb: 'Every big muscle three times a week. The fastest way to build a base and learn the lifts.',
    daysPerWeek: 3,
    weeks: 8,
    deloadEvery: 4,
    days: [
      { name: 'Full body A', focus: ['quads', 'chest', 'back', 'core'] },
      { name: 'Full body B', focus: ['hamstrings', 'shoulders', 'back', 'glutes'] },
      { name: 'Full body C', focus: ['quads', 'chest', 'back', 'biceps', 'triceps'] },
    ],
  },
  {
    id: 'minimal-2',
    name: 'Busy Week',
    level: 'Beginner',
    blurb: 'Two full-body sessions a week for when life is full. Enough to keep strength and muscle.',
    daysPerWeek: 2,
    weeks: 6,
    deloadEvery: 6,
    days: [
      { name: 'Full body A', focus: ['quads', 'chest', 'back', 'shoulders'] },
      { name: 'Full body B', focus: ['hamstrings', 'glutes', 'back', 'chest', 'core'] },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower',
    level: 'Intermediate',
    blurb: 'Four days, each muscle twice a week with more sets per session. A classic for building muscle.',
    daysPerWeek: 4,
    weeks: 8,
    deloadEvery: 4,
    days: [
      { name: 'Upper', focus: UPPER },
      { name: 'Lower', focus: LOWER },
      { name: 'Upper', focus: ['back', 'shoulders', 'chest', 'triceps', 'biceps'] },
      { name: 'Lower', focus: ['hamstrings', 'glutes', 'quads', 'calves', 'core'] },
    ],
  },
  {
    id: 'strength-3',
    name: 'Strength Base',
    level: 'Intermediate',
    blurb: 'Heavy compound lifts for low reps, three days a week. Switches your goal to Strength while you follow it.',
    daysPerWeek: 3,
    weeks: 12,
    deloadEvery: 4,
    goal: 'strength',
    days: [
      { name: 'Squat and press', focus: ['quads', 'chest', 'back'] },
      { name: 'Hinge and overhead', focus: ['hamstrings', 'glutes', 'shoulders', 'back'] },
      { name: 'Squat and pull', focus: ['quads', 'back', 'chest', 'core'] },
    ],
  },
  {
    id: 'ppl-6',
    name: 'Push Pull Legs',
    level: 'Advanced',
    blurb: 'Six days: push, pull and legs, twice through. High volume for experienced lifters who recover well.',
    daysPerWeek: 6,
    weeks: 6,
    deloadEvery: 6,
    days: [
      { name: 'Push', focus: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull', focus: ['back', 'biceps', 'core'] },
      { name: 'Legs', focus: ['quads', 'hamstrings', 'glutes', 'calves'] },
      { name: 'Push', focus: ['shoulders', 'chest', 'triceps'] },
      { name: 'Pull', focus: ['back', 'biceps', 'core'] },
      { name: 'Legs', focus: ['hamstrings', 'glutes', 'quads', 'calves'] },
    ],
  },
];

export const PROGRAM_BY_ID = new Map(PROGRAMS.map((p) => [p.id, p]));

/** What's saved while following a program. Progress moves on per session done, so a missed day never breaks it. */
export interface ProgramState {
  id: string;
  startedAt: string;
  sessionsDone: number;
}

export interface ProgramStep {
  program: Program;
  day: ProgramDay;
  /** 1-based. */
  week: number;
  /** 1-based, within the week. */
  dayOfWeek: number;
  deload: boolean;
  /** 0 to 1 through the whole program. */
  progress: number;
  finished: boolean;
}

export function programStep(state: ProgramState): ProgramStep | null {
  const program = PROGRAM_BY_ID.get(state.id);
  if (!program) return null;
  const total = program.daysPerWeek * program.weeks;
  const n = Math.min(state.sessionsDone, total);
  const week = Math.min(program.weeks, Math.floor(n / program.daysPerWeek) + 1);
  return {
    program,
    day: program.days[n % program.days.length],
    week,
    dayOfWeek: (n % program.daysPerWeek) + 1,
    deload: week % program.deloadEvery === 0,
    progress: n / total,
    finished: n >= total,
  };
}

/**
 * A deload week: one set fewer and about 10% lighter, rounded to the plate increment.
 * New lifts and bodyweight moves keep their (empty) weight.
 */
export function deloadWorkout(w: GeneratedWorkout, increment: number): GeneratedWorkout {
  return {
    ...w,
    exercises: w.exercises.map((p) => ({
      ...p,
      sets: p.deload ? p.sets : Math.max(2, p.sets - 1),
      suggestedWeight: p.suggestedWeight == null ? null : Math.max(increment, Math.round((p.suggestedWeight * 0.9) / increment) * increment),
      change: null,
    })),
  };
}
