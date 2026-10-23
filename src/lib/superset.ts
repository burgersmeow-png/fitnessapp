// Supersets: two lifts done back to back, resting only after the second. Pure.

/** Exercise ids of a superset, in the order they're done. */
export type Pair = [string, string];

interface SetLike {
  id: number;
  exerciseId: string;
  completedAt: string | null;
  restSeconds: number;
}

export function partnerOf(exerciseId: string, pairs: Pair[]): { partner: string; first: boolean } | null {
  for (const [a, b] of pairs) {
    if (a === exerciseId) return { partner: b, first: true };
    if (b === exerciseId) return { partner: a, first: false };
  }
  return null;
}

/** In a superset, the partner lift's next open set comes next; null means follow the normal order. */
export function supersetNext<T extends SetLike>(done: T, sets: T[], pairs: Pair[]): T | null {
  const p = partnerOf(done.exerciseId, pairs);
  if (!p) return null;
  return sets.find((s) => s.exerciseId === p.partner && !s.completedAt && s.id !== done.id) ?? null;
}

/** No rest between the first lift and its partner; the full rest after the second. */
export function restAfterSet<T extends SetLike>(done: T, sets: T[], pairs: Pair[]): number {
  const p = partnerOf(done.exerciseId, pairs);
  if (p?.first && supersetNext(done, sets, pairs)) return 0;
  return done.restSeconds;
}

/** Links two lifts, dropping any pair either was already in. */
export function link(pairs: Pair[], a: string, b: string): Pair[] {
  return [...unlink(unlink(pairs, a), b), [a, b]];
}

export const unlink = (pairs: Pair[], exerciseId: string): Pair[] => pairs.filter((p) => !p.includes(exerciseId));
