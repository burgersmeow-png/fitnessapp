// Weekly goal, streaks, badges and reminder times. Pure: no storage or notifications here
// (see src/services/habits.ts and src/services/reminders.ts).
import { estimate1RM } from './progression';
import { startOfWeek } from './social';

/** Local calendar day, e.g. "2026-10-23". Two sessions on one day count once toward the goal. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Training days per Monday-start week, keyed by that Monday's local midnight. */
function daysPerWeek(dates: string[]): Map<number, number> {
  const days = new Map<number, Set<string>>();
  for (const iso of dates) {
    const d = new Date(iso);
    const week = startOfWeek(d).getTime();
    days.set(week, (days.get(week) ?? new Set()).add(dayKey(d)));
  }
  return new Map([...days].map(([w, s]) => [w, s.size]));
}

/** Monday of the week before. Steps by calendar date so daylight saving changes don't drift it. */
const previousWeek = (monday: number) => {
  const d = new Date(monday);
  d.setDate(d.getDate() - 7);
  return d.getTime();
};

export interface WeekProgress {
  /** Training days so far this week. */
  done: number;
  goal: number;
  /** Consecutive weeks that hit the goal. This week joins once it is hit, and never breaks it while in progress. */
  streak: number;
  /** Days left this week, today included. */
  daysLeft: number;
}

export function weekProgress(dates: string[], goal: number, now = new Date()): WeekProgress {
  const perWeek = daysPerWeek(dates);
  const thisWeek = startOfWeek(now).getTime();
  const done = perWeek.get(thisWeek) ?? 0;
  let streak = done >= goal ? 1 : 0;
  for (let w = previousWeek(thisWeek); (perWeek.get(w) ?? 0) >= goal; w = previousWeek(w)) streak++;
  return { done, goal, streak, daysLeft: 7 - ((now.getDay() + 6) % 7) };
}

/** The longest run of goal weeks ever, for badges. */
export function bestStreak(dates: string[], goal: number): number {
  const hit = [...daysPerWeek(dates)].filter(([, n]) => n >= goal).map(([w]) => w).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  hit.forEach((w, i) => {
    run = i > 0 && previousWeek(w) === hit[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** One encouraging line for the weekly goal card and reminders. */
export function goalLine(p: WeekProgress): string {
  const left = p.goal - p.done;
  if (left <= 0) return p.done > p.goal ? `Goal smashed: ${p.done} of ${p.goal} this week.` : 'Weekly goal hit. Anything more is a bonus.';
  if (left > p.daysLeft) return `${left} to go and ${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left. Every session still counts.`;
  return `${left} more ${left === 1 ? 'session' : 'sessions'} to hit your goal.`;
}

/** A completed set in the order it was done. Weights in any one unit. */
export interface SetForPr {
  exerciseId: string;
  weight: number;
  reps: number;
  rir: number | null;
  completedAt: string;
}

/**
 * How many times a lift beat its best estimated 1RM, at most once per lift per day.
 * The first time a lift is done sets the baseline and isn't a PR.
 */
export function countPrs(sets: SetForPr[]): number {
  const best = new Map<string, number>();
  const counted = new Set<string>();
  let prs = 0;
  for (const s of [...sets].sort((a, b) => a.completedAt.localeCompare(b.completedAt))) {
    if (s.weight <= 0 || s.reps <= 0) continue;
    const e1rm = estimate1RM(s.weight, s.reps, s.rir);
    const previous = best.get(s.exerciseId);
    if (previous != null && e1rm > previous) {
      const key = `${s.exerciseId}@${dayKey(new Date(s.completedAt))}`;
      if (!counted.has(key)) prs++;
      counted.add(key);
    }
    if (previous == null || e1rm > previous) best.set(s.exerciseId, e1rm);
  }
  return prs;
}

export interface HabitStats {
  workouts: number;
  cardio: number;
  prs: number;
  volumeKg: number;
  foodDays: number;
  bestStreak: number;
}

export type BadgeIcon = 'flame' | 'trophy' | 'barbell' | 'pulse' | 'food' | 'sets';

export interface Badge {
  id: string;
  title: string;
  /** How to earn it, shown while locked. */
  how: string;
  icon: BadgeIcon;
  /** Progress toward it, from 0 to 1. */
  progress: (s: HabitStats) => number;
}

const toward = (key: keyof HabitStats, target: number) => (s: HabitStats) => Math.min(1, s[key] / target);

const ladder = (key: keyof HabitStats, icon: BadgeIcon, steps: [number, string, string][]): Badge[] =>
  steps.map(([n, title, how]) => ({ id: `${key}-${n}`, title, how, icon, progress: toward(key, n) }));

// Early badges come quickly so the habit gets rewarded while it is fragile; later ones are rarer.
export const BADGES: Badge[] = [
  ...ladder('workouts', 'barbell', [
    [1, 'First lift', 'Finish your first workout.'],
    [10, 'Ten down', 'Finish 10 workouts.'],
    [25, 'Regular', 'Finish 25 workouts.'],
    [50, 'Half century', 'Finish 50 workouts.'],
    [100, 'Centurion', 'Finish 100 workouts.'],
  ]),
  ...ladder('bestStreak', 'flame', [
    [2, 'Back to back', 'Hit your weekly goal two weeks running.'],
    [4, 'Month strong', 'Hit your weekly goal four weeks running.'],
    [12, 'Unbreakable', 'Hit your weekly goal 12 weeks running.'],
  ]),
  ...ladder('prs', 'trophy', [
    [1, 'New best', 'Beat a personal record.'],
    [10, 'Record breaker', 'Set 10 personal records.'],
    [50, 'Getting strong', 'Set 50 personal records.'],
  ]),
  ...ladder('volumeKg', 'sets', [
    [10_000, '10 tonnes', 'Lift 10,000 kg in total.'],
    [100_000, '100 tonnes', 'Lift 100,000 kg in total.'],
  ]),
  ...ladder('cardio', 'pulse', [
    [1, 'Heart starter', 'Log your first cardio session.'],
    [10, 'Engine', 'Log 10 cardio sessions.'],
  ]),
  ...ladder('foodDays', 'food', [
    [1, 'First bite', 'Log food on one day.'],
    [7, 'Mindful week', 'Log food on 7 different days.'],
    [30, 'Fuelled', 'Log food on 30 different days.'],
  ]),
];

/** Ids of the badges these stats have earned. */
export const earnedBadges = (s: HabitStats) => BADGES.filter((b) => b.progress(s) >= 1).map((b) => b.id);

/** Volume badges are written in kg; pounds users see their own unit. */
export function badgeHow(b: Badge, units: 'kg' | 'lb'): string {
  if (units === 'kg' || !b.id.startsWith('volumeKg-')) return b.how;
  const lb = Math.round((Number(b.id.split('-')[1]) * 2.20462) / 1000) * 1000;
  return `Lift ${lb.toLocaleString('en-US')} lb in total.`;
}

/**
 * When to send training reminders over the next `days` days: on the chosen weekdays
 * (0 = Sunday) at `minutes` after midnight. Skips today if the user already trained,
 * and the rest of the week once the weekly goal is hit.
 */
export function reminderTimes(
  weekdays: number[],
  minutes: number,
  p: { trainedToday: boolean; goalHit: boolean },
  now = new Date(),
  days = 14,
): Date[] {
  const out: Date[] = [];
  const monday = startOfWeek(now);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).getTime();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Math.floor(minutes / 60), minutes % 60);
    if (!weekdays.includes(d.getDay()) || d.getTime() <= now.getTime()) continue;
    if (i === 0 && p.trainedToday) continue;
    if (p.goalHit && d.getTime() < nextMonday) continue;
    out.push(d);
  }
  return out;
}

/** "17:30" or "5:30 PM", whichever the phone uses. */
export const formatTime = (minutes: number) =>
  new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
