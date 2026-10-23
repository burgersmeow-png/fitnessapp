// Alternatives for a lift mid-workout, e.g. when the rack or machine is taken. Pure.
import type { Equipment, Exercise } from './types';

export interface SwapOption {
  exercise: Exercise;
  /** 'same': works the same muscles the same way. 'close': overlaps, a decent stand-in. */
  match: 'same' | 'close';
}

/**
 * Lifts that train the same main muscle with equipment the lifter has, closest first.
 * Lifts already in today's workout are left out so a swap never doubles one up.
 */
export function swapOptions(
  current: Exercise,
  all: Exercise[],
  equipment: Equipment[],
  inWorkout: Iterable<string> = [],
  limit = 8,
): SwapOption[] {
  const skip = new Set(inWorkout);
  const main = current.primary[0];
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((m) => b.includes(m));
  const score = (e: Exercise) =>
    3 * e.primary.filter((m) => current.primary.includes(m)).length -
    e.primary.filter((m) => !current.primary.includes(m)).length +
    e.secondary.filter((m) => current.secondary.includes(m)).length +
    (e.compound === current.compound ? 2 : 0);
  return all
    .filter((e) => e.id !== current.id && !skip.has(e.id) && equipment.includes(e.equipment) && e.primary.includes(main))
    .map((e) => ({ e, s: score(e) }))
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map(({ e }) => ({
      exercise: e,
      match: same(e.primary, current.primary) && e.compound === current.compound ? 'same' : 'close',
    }));
}
