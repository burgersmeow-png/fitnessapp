// The lifter's own exercises, for lifts the built-in list doesn't have. Pure.
import type { Equipment, Exercise, Muscle } from './types';

export const NAME_MAX = 40;

export interface CustomDraft {
  name: string;
  equipment: Equipment | null;
  primary: Muscle[];
  secondary: Muscle[];
}

/** What's still missing, in plain words, or null when the draft can be saved. */
export function draftProblem(d: CustomDraft, takenNames: string[]): string | null {
  const name = d.name.trim();
  if (!name) return 'Give it a name.';
  if (takenNames.some((n) => n.toLowerCase() === name.toLowerCase())) return 'You already have an exercise with that name.';
  if (!d.equipment) return 'Pick the equipment it uses.';
  if (d.primary.length === 0) return 'Pick at least one main muscle.';
  return null;
}

/** A stable id from the name that can't clash with built-in ids or other custom ones. */
export function customId(name: string, takenIds: string[]): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'lift';
  let id = `custom-${slug}`;
  for (let n = 2; takenIds.includes(id); n++) id = `custom-${slug}-${n}`;
  return id;
}

/** Builds the exercise. Lifts that also work helper muscles count as compound, like the built-ins. */
export function makeCustomExercise(d: CustomDraft, takenIds: string[]): Exercise {
  const name = d.name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  const secondary = d.secondary.filter((m) => !d.primary.includes(m));
  return {
    id: customId(name, takenIds),
    name,
    equipment: d.equipment!,
    primary: d.primary,
    secondary,
    compound: d.primary.length + secondary.length > 1,
    custom: true,
  };
}
