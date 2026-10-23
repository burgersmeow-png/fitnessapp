// "How far I've come": a story card of strength gains since someone started. Pure.
import { compactNumber, MAX_LINES, type CardContent } from './shareCard';
import type { LoggedSet } from './types';

export interface LiftGain {
  exerciseId: string;
  /** Heaviest weight on the first day the lift was trained. */
  from: number;
  /** Heaviest weight ever. */
  to: number;
}

export interface ProgressSummary {
  since: string;
  weeks: number;
  workouts: number;
  volume: number;
  gains: LiftGain[];
}

const day = (iso: string) => iso.slice(0, 10);

/** Gains per lift, biggest relative gain first. null until there are two workouts to compare. */
export function progressSummary(history: LoggedSet[], workoutDates: string[], now: Date): ProgressSummary | null {
  const dates = [...workoutDates].sort();
  if (dates.length < 2) return null;
  const firstDay = new Map<string, string>();
  for (const s of history) if (s.weight > 0 && s.reps > 0) {
    const d = firstDay.get(s.exerciseId);
    if (!d || s.completedAt < d) firstDay.set(s.exerciseId, s.completedAt);
  }
  const from = new Map<string, number>();
  const to = new Map<string, number>();
  for (const s of history) {
    if (s.weight <= 0 || s.reps <= 0) continue;
    if (day(s.completedAt) === day(firstDay.get(s.exerciseId)!)) from.set(s.exerciseId, Math.max(from.get(s.exerciseId) ?? 0, s.weight));
    to.set(s.exerciseId, Math.max(to.get(s.exerciseId) ?? 0, s.weight));
  }
  const gains = [...to]
    .map(([exerciseId, best]) => ({ exerciseId, from: from.get(exerciseId) ?? best, to: best }))
    .filter((g) => g.to > g.from)
    .sort((a, b) => b.to / b.from - a.to / a.from || b.to - b.from - (a.to - a.from));
  const since = dates[0];
  return {
    since,
    weeks: Math.max(1, Math.ceil((now.getTime() - Date.parse(since)) / (7 * 864e5))),
    workouts: dates.length,
    volume: history.reduce((n, s) => n + Math.max(0, s.weight) * Math.max(0, s.reps), 0),
    gains,
  };
}

const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US');

export function progressCardContent(p: ProgressSummary, name: (id: string) => string, units: string, locale?: string): CardContent {
  const since = new Date(p.since).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
  return {
    eyebrow: `MY PROGRESS · SINCE ${since}`,
    headline: p.gains.length ? `${p.weeks} ${p.weeks === 1 ? 'WEEK' : 'WEEKS'} STRONGER` : `${p.workouts} WORKOUTS IN`,
    stats: [
      { value: String(p.weeks), label: p.weeks === 1 ? 'WEEK' : 'WEEKS' },
      { value: String(p.workouts), label: 'WORKOUTS' },
      { value: compactNumber(p.volume), label: `${units.toUpperCase()} LIFTED` },
    ],
    lines: p.gains.slice(0, MAX_LINES).map((g) => ({
      name: name(g.exerciseId),
      detail: `${num(g.from)} → ${num(g.to)} ${units} (+${num(g.to - g.from)})`,
      pr: true,
    })),
    more: Math.max(0, p.gains.length - MAX_LINES),
    footer: 'Tracked with LiftLab',
  };
}
