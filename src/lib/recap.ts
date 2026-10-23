// The monthly recap card: a month of training squeezed onto one story-sized image. Pure.
import type { PrEvent } from './records';
import { compactNumber, type CardContent } from './shareCard';
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

/** null when nothing was logged that month. */
export function recapContent(r: RecapInput, locale?: string): CardContent | null {
  const lifts = r.workouts.filter((w) => inMonth(w.startedAt, r.month));
  const cardio = r.cardio.filter((c) => inMonth(c.startedAt, r.month));
  if (lifts.length + cardio.length === 0) return null;

  const minutes =
    lifts.reduce((t, w) => t + Math.max(0, (Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60000), 0) +
    cardio.reduce((t, c) => t + c.minutes, 0);
  const volume = lifts.reduce((t, w) => t + w.volume, 0);

  // Biggest gain per lift this month, biggest first.
  const bestPr = new Map<string, PrEvent>();
  for (const p of r.prs.filter((p) => inMonth(p.at, r.month))) {
    const cur = bestPr.get(p.exerciseId);
    if (!cur || p.gain > cur.gain) bestPr.set(p.exerciseId, p);
  }
  const prLines = [...bestPr.values()]
    .sort((a, b) => b.gain - a.gain)
    .map((p) => ({ name: r.name(p.exerciseId), detail: `+${Math.round(p.gain)} ${r.units} est. max · ${p.weight} × ${p.reps}`, pr: true }));

  const setsBy = new Map<string, number>();
  for (const s of r.history) if (inMonth(s.completedAt, r.month)) setsBy.set(s.exerciseId, (setsBy.get(s.exerciseId) ?? 0) + 1);
  const workLines = [...setsBy.entries()]
    .filter(([id]) => !bestPr.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ name: r.name(id), detail: `${n} ${n === 1 ? 'set' : 'sets'} this month`, pr: false }));

  const all = [...prLines, ...workLines];
  const sessions = lifts.length + cardio.length;
  const month = r.month.toLocaleDateString(locale, { month: 'long' }).toUpperCase();
  return {
    eyebrow: `MY MONTH · ${r.month.getFullYear()}`,
    headline: month,
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
