// Plans: several workout days in one link ("Alex's 4-day split"). Followers rotate through the
// days in order, one per session. Pure.
import { cleanWorkout, fromBase64Url, packWorkout, toBase64Url, type WorkoutLink } from './workoutLink';

export interface PlanLink {
  title: string;
  days: WorkoutLink[];
}

export interface FollowedPlan extends PlanLink {
  /** Which day is up next, from 0. */
  next: number;
  /** Days finished so far, for "12 sessions in". */
  done: number;
  startedAt: string;
}

export const MAX_DAYS = 7;
export const PLAN_TITLE_MAX = 40;
const VERSION = 1;

export function encodePlan(p: PlanLink): string {
  return toBase64Url(JSON.stringify([VERSION, p.title.trim().slice(0, PLAN_TITLE_MAX), p.days.slice(0, MAX_DAYS).map(packWorkout)]));
}

export function decodePlan(payload: string | null | undefined): PlanLink | null {
  if (!payload || payload.length > 12000) return null;
  const json = fromBase64Url(payload);
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw) || raw[0] !== VERSION || !Array.isArray(raw[2]) || raw[2].length === 0) return null;
    const days: WorkoutLink[] = [];
    for (const [i, d] of raw[2].slice(0, MAX_DAYS).entries()) {
      if (!Array.isArray(d)) return null;
      const w = cleanWorkout(d[0], d[1]);
      if (!w) return null;
      days.push(w.title === 'Shared workout' ? { ...w, title: `Day ${i + 1}` } : w);
    }
    const title = typeof raw[1] === 'string' ? raw[1].replace(/[\u0000-\u001f]/g, '').trim().slice(0, PLAN_TITLE_MAX) : '';
    return { title: title || `${days.length}-day plan`, days };
  } catch {
    return null;
  }
}

export const planUrl = (site: string, p: PlanLink) => `${site.replace(/\/?$/, '/')}?p=${encodePlan(p)}`;

export const followPlan = (p: PlanLink, now = new Date()): FollowedPlan => ({ ...p, next: 0, done: 0, startedAt: now.toISOString() });

/** After finishing the day that was up: on to the next, wrapping back to day 1. */
export const advancePlan = (f: FollowedPlan): FollowedPlan => ({ ...f, next: (f.next + 1) % f.days.length, done: f.done + 1 });

/** Same plan, whoever shared it: used to tell if you already follow it. */
export const samePlan = (a: PlanLink, b: PlanLink) => encodePlan(a) === encodePlan(b);
