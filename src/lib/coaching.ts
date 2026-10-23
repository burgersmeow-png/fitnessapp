// Trainer mode shapes and maths. Pure: no network here (see src/services/coaching.ts).
import type { FeedPost, Profile } from './social';
import { startOfWeek } from './social';
import type { PlannedExercise } from './types';

export interface PlanItem {
  exerciseId: string;
  sets: number;
  reps: number;
  /** Null lets the client pick the weight. */
  weightKg: number | null;
}

export interface Assignment {
  id: number;
  coach: string;
  client: string;
  title: string;
  note: string;
  plan: PlanItem[];
  /** Local date, YYYY-MM-DD. */
  scheduledFor: string;
  completedAt: string | null;
}

export interface ClientSummary {
  client: Profile;
  lastSessionAt: string | null;
  sessionsThisWeek: number;
  /** Assignments due in the last 14 days (or done today), and how many were done. */
  due: number;
  done: number;
  /** Nothing logged for 5 days, or a missed assignment: worth a message. */
  needsNudge: boolean;
}

const DAY = 864e5;

/** YYYY-MM-DD in local time. */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function summarizeClient(client: Profile, posts: FeedPost[], assignments: Assignment[], now: Date): ClientSummary {
  const mine = posts.filter((p) => p.author.id === client.id).sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
  const week = startOfWeek(now).getTime();
  const today = localDate(now);
  const from = localDate(new Date(now.getTime() - 14 * DAY));
  const due = assignments.filter((a) => a.client === client.id && a.scheduledFor >= from && (a.scheduledFor < today || (a.scheduledFor === today && a.completedAt)));
  const done = due.filter((a) => a.completedAt).length;
  const last = mine[0]?.happenedAt ?? null;
  const idle = !last || now.getTime() - Date.parse(last) > 5 * DAY;
  return {
    client,
    lastSessionAt: last,
    sessionsThisWeek: mine.filter((p) => Date.parse(p.happenedAt) >= week).length,
    due: due.length,
    done,
    needsNudge: idle || done < due.length,
  };
}

/** Clients who need attention first, then by most recent activity. */
export const sortClients = (rows: ClientSummary[]) =>
  [...rows].sort((a, b) => Number(b.needsNudge) - Number(a.needsNudge) || (b.lastSessionAt ?? '').localeCompare(a.lastSessionAt ?? ''));

/** The client's next assignment: today's or the earliest overdue one not yet done. */
export function nextAssignment(assignments: Assignment[], now: Date): Assignment | null {
  const today = localDate(now);
  return assignments.filter((a) => !a.completedAt && a.scheduledFor <= today).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))[0] ?? null;
}

/** Turns a coach's plan into the app's workout plan. `toDisplay` converts kg to the client's units. */
export function planToWorkout(plan: PlanItem[], toDisplay: (kg: number) => number): PlannedExercise[] {
  return plan.map((p) => ({
    exerciseId: p.exerciseId,
    sets: p.sets,
    targetReps: p.reps,
    targetRir: 2,
    suggestedWeight: p.weightKg == null ? null : toDisplay(p.weightKg),
    restSeconds: p.reps <= 6 ? 150 : p.reps <= 12 ? 90 : 60,
    status: 'new',
    deload: false,
    change: null,
  }));
}

/** "Today", "Tomorrow", "Yesterday" or "Mon 26 Oct". */
export function dayLabel(date: string, now: Date): string {
  const today = localDate(now);
  if (date === today) return 'Today';
  if (date === localDate(new Date(now.getTime() + DAY))) return 'Tomorrow';
  if (date === localDate(new Date(now.getTime() - DAY))) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
