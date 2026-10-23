// Trends for the Progress screen: body weight, strength per lift and training days per week.
// Pure: no storage here (see src/lib/db.ts).
import { dayKey } from './habits';
import { estimate1RM } from './progression';
import { startOfWeek } from './social';
import type { LoggedSet } from './types';

export interface Point {
  /** Milliseconds since 1970. */
  t: number;
  v: number;
}

const DAY = 864e5;

/**
 * Trailing average over the previous `days` days at each point. Daily weigh-ins swing a kilo or
 * two with water and food; the trend is what's really changing.
 */
export function trend(points: Point[], days = 7): Point[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  return sorted.map((p) => {
    const window = sorted.filter((q) => q.t <= p.t && q.t > p.t - days * DAY);
    return { t: p.t, v: window.reduce((s, q) => s + q.v, 0) / window.length };
  });
}

/** Change in the trend over the last `days` days, or null without readings at both ends. */
export function trendChange(points: Point[], days: number, now = Date.now()): number | null {
  const smooth = trend(points);
  if (smooth.length < 2) return null;
  const last = smooth[smooth.length - 1];
  const before = [...smooth].reverse().find((p) => p.t <= now - days * DAY) ?? smooth[0];
  if (before === last || last.t - before.t < 3 * DAY) return null;
  return last.v - before.v;
}

/** Plain words for a weight change, judged against the user's nutrition goal. */
export function weightNote(change: number | null, goal: 'lose' | 'maintain' | 'gain', unit: string): string {
  if (change == null) return 'Weigh in a few times a week, same time of day, to see your trend.';
  const amount = `${Math.abs(Math.round(change * 10) / 10)} ${unit}`;
  const steady = Math.abs(change) < (unit === 'lb' ? 0.5 : 0.25);
  if (steady) return goal === 'maintain' ? 'Steady over 30 days. Right on plan.' : 'Steady over 30 days.';
  const dir = change < 0 ? 'Down' : 'Up';
  const onPlan = (goal === 'lose' && change < 0) || (goal === 'gain' && change > 0);
  return `${dir} ${amount} over 30 days${onPlan ? '. Right on plan.' : '.'}`;
}

export interface LiftTrend {
  exerciseId: string;
  /** Best estimated 1RM per training day, oldest first. */
  points: Point[];
  best: number;
  /** Percent change in best e1RM over the window, comparing first and last fortnights. */
  changePct: number | null;
  sessions: number;
}

/** The lifts trained most, each with its strength trend, for the last `weeks` weeks. */
export function liftTrends(history: LoggedSet[], now = Date.now(), weeks = 12, limit = 5): LiftTrend[] {
  const since = now - weeks * 7 * DAY;
  const byLift = new Map<string, Map<string, Point>>();
  for (const s of history) {
    const t = Date.parse(s.completedAt);
    if (t < since || s.weight <= 0 || s.reps <= 0) continue;
    const e1rm = estimate1RM(s.weight, s.reps, s.rir);
    const days = byLift.get(s.exerciseId) ?? new Map<string, Point>();
    const key = dayKey(new Date(t));
    if ((days.get(key)?.v ?? 0) < e1rm) days.set(key, { t, v: e1rm });
    byLift.set(s.exerciseId, days);
  }
  return [...byLift]
    .map(([exerciseId, days]) => {
      const points = [...days.values()].sort((a, b) => a.t - b.t);
      const first = points.filter((p) => p.t < points[0].t + 14 * DAY);
      const last = points.filter((p) => p.t > points[points.length - 1].t - 14 * DAY);
      const spread = points[points.length - 1].t - points[0].t;
      const from = Math.max(...first.map((p) => p.v));
      const to = Math.max(...last.map((p) => p.v));
      return {
        exerciseId,
        points,
        best: Math.max(...points.map((p) => p.v)),
        changePct: points.length >= 3 && spread >= 21 * DAY ? Math.round(((to - from) / from) * 100) : null,
        sessions: points.length,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.best - a.best)
    .slice(0, limit);
}

/** Training days in each of the last `weeks` Monday-start weeks, oldest first; this week last. */
export function trainingDaysPerWeek(dates: string[], now = new Date(), weeks = 12): { weekStart: Date; days: number }[] {
  const monday = startOfWeek(now);
  const out = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - i)),
    days: new Set<string>(),
  }));
  for (const iso of dates) {
    const d = new Date(iso);
    const w = startOfWeek(d).getTime();
    out.find((x) => x.weekStart.getTime() === w)?.days.add(dayKey(d));
  }
  return out.map((x) => ({ weekStart: x.weekStart, days: x.days.size }));
}
