// First-run setup: turns a few plain answers into settings and a starting program. Pure.
import type { Equipment, Goal, Settings } from './types';

export type MainGoal = 'muscle' | 'strength' | 'lose' | 'fit';
export type Experience = 'new' | 'some' | 'experienced';

export const MAIN_GOALS: { value: MainGoal; title: string; detail: string }[] = [
  { value: 'muscle', title: 'Build muscle', detail: 'Grow size with 8–12 rep sets' },
  { value: 'strength', title: 'Get stronger', detail: 'Lift heavier with lower reps' },
  { value: 'lose', title: 'Lose fat', detail: 'Keep muscle while eating less' },
  { value: 'fit', title: 'Get fit', detail: 'Stamina, lighter weights, shorter rests' },
];

export const EXPERIENCE: { value: Experience; title: string; detail: string }[] = [
  { value: 'new', title: 'New to lifting', detail: 'Under 6 months, or coming back after a long break' },
  { value: 'some', title: 'Some experience', detail: 'I know the main lifts and train fairly regularly' },
  { value: 'experienced', title: 'Experienced', detail: 'Years of steady training' },
];

export const EQUIPMENT_PRESETS: { id: string; title: string; detail: string; equipment: Equipment[] }[] = [
  { id: 'gym', title: 'Full gym', detail: 'Barbells, machines, cables, dumbbells', equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'bands'] },
  { id: 'home', title: 'Home with dumbbells', detail: 'Dumbbells, maybe bands or a kettlebell', equipment: ['dumbbell', 'kettlebell', 'bands', 'bodyweight'] },
  { id: 'none', title: 'No equipment', detail: 'Bodyweight anywhere', equipment: ['bodyweight'] },
];

/** The training goal and eating goal behind each main goal. */
export function goalSettings(main: MainGoal): { goal: Goal; nutritionGoal: Settings['nutritionGoal'] } {
  switch (main) {
    case 'muscle':
      return { goal: 'hypertrophy', nutritionGoal: 'gain' };
    case 'strength':
      return { goal: 'strength', nutritionGoal: 'maintain' };
    case 'lose':
      // Lifting for muscle while in a deficit keeps the weight lost coming from fat.
      return { goal: 'hypertrophy', nutritionGoal: 'lose' };
    case 'fit':
      return { goal: 'endurance', nutritionGoal: 'maintain' };
  }
}

/**
 * A program that fits the days available and experience, or null for "just plan each day for me".
 * Beginners get full-body sessions (practice each lift more often); more days suit splits.
 */
export function recommendProgram(main: MainGoal, experience: Experience, days: number): string | null {
  if (days <= 2) return 'minimal-2';
  if (main === 'strength' && experience !== 'new' && days === 3) return 'strength-3';
  if (experience === 'new' || days === 3) return 'full-body-3';
  if (days === 4 || days === 5) return 'upper-lower-4';
  return experience === 'experienced' ? 'ppl-6' : 'upper-lower-4';
}

/** Suggested days a week: enough to progress, not so many a beginner burns out. */
export const suggestedDays = (experience: Experience) => (experience === 'new' ? 3 : experience === 'some' ? 4 : 5);

/** Rough kg/lb guess from where the phone is set, so most people never touch the units. */
export const unitsForLocale = (locale: string): Settings['units'] => (/^en-(US|LR)\b|-(US|LR|MM)$/i.test(locale) ? 'lb' : 'kg');

/** First-run is for brand-new users; anyone who already logged a session skips it. */
export const needsOnboarding = (s: Settings, hasSessions: boolean) => !s.onboarded && !hasSessions;
