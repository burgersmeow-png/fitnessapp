// The recap cards: a month or a week of training squeezed onto one story-sized image. Pure.
import type { PrEvent } from './records';
import { compactNumber, type CardContent } from './shareCard';
import { startOfWeek } from './social';
import type { LoggedSet } from './types';

export interface RecapInput {
  /** Any date inside the month to recap. */
  month: Date;
  workouts: { startedAt: string; finishedAt: string; volume: number }[];
  cardio: { startedAt: string; minutes: number }[];
  history: LoggedSet[];
  prs: PrEvent[];
  name: (exerciseId: string) => string;
  units: 'kg' | 'lb';
}

const inMonth = (iso: string, m: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
};

/**
 * Which month to recap. Early in a month there is little to show, so the first week
 * still recaps last month when last month had training in it.
 */
export function recapMonth(now: Date, trainedOn: string[]): Date {
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (now.getDate() <= 7 && trainedOn.some((t) => inMonth(t, last))) return last;
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Minutes under an hour, then hours with one decimal under 10, so a light month still shows something. */
export function timeStat(minutes: number): { value: string; label: string } {
  if (minutes < 60) return { value: String(Math.round(minutes)), label: 'MINUTES' };
  const h = minutes / 60;
  return { value: h < 10 ? String(Math.round(h * 10) / 10) : String(Math.round(h)), label: 'HOURS' };
}

export const RECAP_LINES = 5;

interface Period {
  has: (iso: string) => boolean;
  eyebrow: string;
  headline: string;
  /** "month" or "week", for the sets line. */
  word: string;
}

/** null when nothing was logged that month. */
export function recapContent(r: RecapInput, locale?: string): CardContent | null {
  return build(r, {
    has: (iso) => inMonth(iso, r.month),
    eyebrow: `MY MONTH · ${r.month.getFullYear()}`,
    headline: r.month.toLocaleDateString(locale, { month: 'long' }).toUpperCase(),
    word: 'month',
  });
}

const DAY = 864e5;

/**
 * Which week to recap, as its Monday. On Monday the new week is empty, so it still
 * recaps last week when last week had training in it.
 */
export function recapWeek(now: Date, trainedOn: string[]): Date {
  const monday = startOfWeek(now);
  const last = startOfWeek(new Date(monday.getTime() - DAY));
  const inLast = (t: string) => Date.parse(t) >= last.getTime() && Date.parse(t) < monday.getTime();
  const trainedThisWeek = trainedOn.some((t) => Date.parse(t) >= monday.getTime());
  if (now.getDay() === 1 && !trainedThisWeek && trainedOn.some(inLast)) return last;
  return monday;
}

/** "OCT 19 – 25", or "SEP 28 – OCT 4" across a month. */
export function weekLabel(monday: Date, locale?: string): string {
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const mon = (d: Date) => d.toLocaleDateString(locale, { month: 'short' }).toUpperCase().replace('.', '');
  const end = sunday.getMonth() === monday.getMonth() ? String(sunday.getDate()) : `${mon(sunday)} ${sunday.getDate()}`;
  return `${mon(monday)} ${monday.getDate()} – ${end}`;
}

/** The week starting on `week` (a Monday). null when nothing was logged that week. */
export function weekRecapContent(r: Omit<RecapInput, 'month'> & { week: Date }, locale?: string): CardContent | null {
  const from = startOfWeek(r.week);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  return build({ ...r, month: from }, {
    has: (iso) => Date.parse(iso) >= from.getTime() && Date.parse(iso) < to.getTime(),
    eyebrow: `MY WEEK · ${from.getFullYear()}`,
    headline: weekLabel(from, locale),
    word: 'week',
  });
}

function build(r: RecapInput, p: Period): CardContent | null {
  const lifts = r.workouts.filter((w) => p.has(w.startedAt));
  const cardio = r.cardio.filter((c) => p.has(c.startedAt));
  if (lifts.length + cardio.length === 0) return null;

  const minutes =
    lifts.reduce((t, w) => t + Math.max(0, (Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000), 0) +
    cardio.reduce((t, c) => t + c.minutes, 0);
  const volume = lifts.reduce((t, w) => t + w.volume, 0);

  // Biggest gain per lift this month, biggest first.
  const bestPr = new Map<string, PrEvent>();
  for (const e of r.prs.filter((x) => p.has(x.at))) {
    const cur = bestPr.get(e.exerciseId);
    if (!cur || e.gain > cur.gain) bestPr.set(e.exerciseId, e);
  }
  const prLines = [...bestPr.values()]
    .sort((a, b) => b.gain - a.gain)
    .map((e) => ({ name: r.name(e.exerciseId), detail: `+${Math.round(e.gain)} ${r.units} est. max · ${e.weight} × ${e.reps}`, pr: true }));

  const setsBy = new Map<string, number>();
  for (const s of r.history) if (p.has(s.completedAt)) setsBy.set(s.exerciseId, (setsBy.get(s.exerciseId) ?? 0) + 1);
  const workLines = [...setsBy.entries()]
    .filter(([id]) => !bestPr.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ name: r.name(id), detail: `${n} ${n === 1 ? 'set' : 'sets'} this ${p.word}`, pr: false }));

  const all = [...prLines, ...workLines];
  const sessions = lifts.length + cardio.length;
  return {
    eyebrow: p.eyebrow,
    headline: p.headline,
    stats: [
      { value: String(sessions), label: sessions === 1 ? 'SESSION' : 'SESSIONS' },
      timeStat(minutes),
      volume > 0
        ? { value: compactNumber(volume), label: `${r.units.toUpperCase()} LIFTED` }
        : { value: String(bestPr.size), label: bestPr.size === 1 ? 'PR' : 'PRS' },
    ],
    lines: all.slice(0, RECAP_LINES),
    more: Math.max(0, all.length - RECAP_LINES),
    footer: bestPr.size > 0 ? `${bestPr.size} new PR${bestPr.size > 1 ? 's' : ''} · Tracked with LiftLab` : 'Planned and tracked with LiftLab',
  };
}
