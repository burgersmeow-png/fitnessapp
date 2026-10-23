// The training calendar: one square per day for the last N weeks, Monday at the top. Pure.
import { dayKey } from './habits';
import type { CardContent } from './shareCard';
import { startOfWeek } from './social';

/** 0 = rest, 1 = cardio only, 2 = lifted. */
export type DayLevel = 0 | 1 | 2;

export interface CalendarDay {
  key: string;
  level: DayLevel;
  /** After today: drawn empty, not counted. */
  future: boolean;
}

export interface TrainingCalendar {
  /** Oldest week first; each week is Monday..Sunday. */
  weeks: CalendarDay[][];
  daysTrained: number;
  sessions: number;
  /** Most training days in any one week shown. */
  bestWeek: number;
  /** Month labels: the week index where each month starts. */
  months: { week: number; label: string }[];
}

export const CALENDAR_WEEKS = 26;

export function trainingCalendar(lifts: string[], cardio: string[], now: Date, weeks = CALENDAR_WEEKS, locale?: string): TrainingCalendar {
  const level = new Map<string, DayLevel>();
  for (const t of cardio) level.set(dayKey(new Date(t)), Math.max(level.get(dayKey(new Date(t))) ?? 0, 1) as DayLevel);
  for (const t of lifts) level.set(dayKey(new Date(t)), 2);
  const today = dayKey(now);
  const thisMonday = startOfWeek(now);
  const first = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 * (weeks - 1));
  const firstKey = dayKey(first);

  const grid: CalendarDay[][] = [];
  const months: { week: number; label: string }[] = [];
  let bestWeek = 0;
  for (let w = 0; w < weeks; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      // Stepping by calendar date keeps daylight saving changes from drifting the grid.
      const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + d);
      const key = dayKey(date);
      const future = key > today;
      week.push({ key, level: future ? 0 : level.get(key) ?? 0, future });
      if (date.getDate() === 1 || (w === 0 && d === 0)) months.push({ week: w, label: date.toLocaleDateString(locale, { month: 'short' }) });
    }
    bestWeek = Math.max(bestWeek, week.filter((x) => x.level > 0).length);
    grid.push(week);
  }
  const inRange = (t: string) => {
    const k = dayKey(new Date(t));
    return k >= firstKey && k <= today;
  };
  return {
    weeks: grid,
    daysTrained: grid.flat().filter((d) => d.level > 0).length,
    sessions: lifts.filter(inRange).length + cardio.filter(inRange).length,
    bestWeek,
    // A label squeezed in at week 0 right before the 1st of the next month would collide; drop it.
    months: months.filter((m, i) => !(i === 0 && months[1] && months[1].week - m.week < 2)),
  };
}

export function calendarCardContent(c: TrainingCalendar): CardContent {
  const months = Math.round(c.weeks.length / 4.35);
  // Averaged from the first week trained, so someone who started last month isn't marked down.
  const firstWeek = c.weeks.findIndex((w) => w.some((d) => d.level > 0));
  const activeWeeks = firstWeek < 0 ? 1 : c.weeks.length - firstWeek;
  return {
    eyebrow: `MY LAST ${months} MONTHS`,
    headline: `${c.daysTrained} ${c.daysTrained === 1 ? 'DAY' : 'DAYS'} TRAINED`,
    stats: [
      { value: String(c.sessions), label: c.sessions === 1 ? 'SESSION' : 'SESSIONS' },
      { value: String(c.bestWeek), label: 'BEST WEEK' },
      { value: `${Math.round((c.daysTrained / activeWeeks) * 10) / 10}`, label: 'DAYS / WEEK' },
    ],
    lines: [],
    more: 0,
    footer: 'Tracked with LiftLab',
    grid: c.weeks.map((w) => w.map((d) => (d.future ? -1 : d.level))),
  };
}
