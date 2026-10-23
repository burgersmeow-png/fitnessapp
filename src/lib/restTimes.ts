// Rest times the lifter set for particular lifts, kept for future workouts. Pure.

export type RestTimes = Record<string, number>;

export const REST_STEP = 15;
export const REST_MIN = 15;
export const REST_MAX = 600;

/** The rest to use after a set: the lifter's own choice for this lift, else the plan's. */
export const restFor = (times: RestTimes, exerciseId: string, planned: number) => times[exerciseId] ?? planned;

/** Nudges a lift's rest by `delta` seconds within sensible limits. Back at the plan's value, the override goes. */
export function adjustRest(times: RestTimes, exerciseId: string, planned: number, delta: number): RestTimes {
  const next = Math.min(REST_MAX, Math.max(REST_MIN, restFor(times, exerciseId, planned) + delta));
  const { [exerciseId]: _old, ...rest } = times;
  return next === planned ? rest : { ...rest, [exerciseId]: next };
}
