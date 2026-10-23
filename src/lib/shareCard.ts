// What goes on the story-sized share card after a workout. Pure.

export interface CardInput {
  startedAt: string;
  minutes: number;
  sets: number;
  volume: number;
  units: 'kg' | 'lb';
  /** Names of lifts that hit a PR today. */
  prs: string[];
  /** Best set first, in the order they were done. */
  exercises: { name: string; sets: number; best: { weight: number | null; reps: number | null } }[];
  /** Weeks in a row hitting the weekly goal. */
  streak?: number;
}

export interface CardContent {
  eyebrow: string;
  headline: string;
  stats: { value: string; label: string }[];
  lines: { name: string; detail: string; pr: boolean }[];
  more: number;
  footer: string;
}

export const MAX_LINES = 5;

/** 950 → "950", 12,345 → "12.3K", 1,250,000 → "1.25M": short enough for a big stat. */
export function compactNumber(n: number): string {
  const r = Math.round(n);
  if (r < 10_000) return r.toLocaleString('en-US');
  if (r < 1_000_000) return `${Math.round(r / 100) / 10}K`;
  return `${Math.round(r / 10_000) / 100}M`;
}

export function cardContent(w: CardInput, locale?: string): CardContent {
  const day = new Date(w.startedAt).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  const prSet = new Set(w.prs);
  // PR lifts first so the brag is above the fold, then the rest in workout order.
  const ordered = [...w.exercises.filter((e) => prSet.has(e.name)), ...w.exercises.filter((e) => !prSet.has(e.name))];
  const lines = ordered.slice(0, MAX_LINES).map((e) => ({
    name: e.name,
    detail:
      e.best.weight != null && e.best.weight > 0 && e.best.reps != null
        ? `${e.best.weight} ${w.units} × ${e.best.reps}`
        : `${e.sets} ${e.sets === 1 ? 'set' : 'sets'}${e.best.reps ? ` · ${e.best.reps} reps` : ''}`,
    pr: prSet.has(e.name),
  }));
  const stats = [
    { value: String(w.minutes), label: 'MINUTES' },
    { value: String(w.sets), label: 'SETS' },
    w.volume > 0 ? { value: compactNumber(w.volume), label: `${w.units.toUpperCase()} LIFTED` } : null,
    w.streak && w.streak > 1 ? { value: String(w.streak), label: 'WEEK STREAK' } : null,
  ].filter((s): s is { value: string; label: string } => s != null).slice(0, 3);
  return {
    eyebrow: `WORKOUT · ${day}`,
    headline: w.prs.length ? `${w.prs.length} NEW PR${w.prs.length > 1 ? 'S' : ''}` : 'WORKOUT DONE',
    stats,
    lines,
    more: Math.max(0, ordered.length - MAX_LINES),
    footer: 'Planned and tracked with LiftLab',
  };
}
