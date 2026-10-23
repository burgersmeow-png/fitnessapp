// What a lifter wants more or less of: "suggest more" lifts come up more often, and
// "don't suggest" lifts are left out of planned workouts (they can still be added by hand). Pure.

export type ExercisePref = 'more' | 'never';
export type ExercisePrefs = Record<string, ExercisePref>;

/** How much sooner a "suggest more" lift comes back round in the rotation. */
export const MORE_BOOST = 3;

export function cleanPrefs(raw: unknown): ExercisePrefs {
  const out: ExercisePrefs = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, p] of Object.entries(raw)) if (p === 'more' || p === 'never') out[id] = p;
  return out;
}

/** Sets or clears (null) one lift's preference. */
export function setPref(prefs: ExercisePrefs, id: string, pref: ExercisePref | null): ExercisePrefs {
  const { [id]: _, ...rest } = prefs;
  return pref ? { ...rest, [id]: pref } : rest;
}

/** Hours since a lift was last done, as the planner sees it: preferred lifts seem staler. */
export const rotationHours = (hours: number, pref: ExercisePref | undefined): number =>
  pref === 'more' ? hours * MORE_BOOST : hours;
