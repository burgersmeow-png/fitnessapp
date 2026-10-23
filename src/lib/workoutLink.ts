// Workout links: a whole workout packed into a URL so a creator can post it and followers
// can load it. No server needed, the plan rides in the link. Pure.
import { suggestNext } from './progression';
import type { Exercise, LoggedSet, PlannedExercise } from './types';

export interface LinkedLift {
  /** Library id on the sender's phone. */
  id: string;
  /** Shown on the landing page, and used to match custom lifts the receiver doesn't have. */
  name: string;
  sets: number;
  reps: number;
  rest: number;
}

export interface WorkoutLink {
  title: string;
  lifts: LinkedLift[];
}

export const LINK_VERSION = 1;
export const MAX_LIFTS = 15;
export const TITLE_MAX = 40;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** UTF-8 then base64url, without padding. Works the same in Node, Hermes and browsers. */
export function toBase64Url(text: string): string {
  const bytes = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes.charCodeAt(i) << 16) | ((bytes.charCodeAt(i + 1) || 0) << 8) | (bytes.charCodeAt(i + 2) || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function fromBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  let bytes = '';
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : 0));
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    bytes += String.fromCharCode((n >> 16) & 255);
    if (i + 2 < s.length) bytes += String.fromCharCode((n >> 8) & 255);
    if (i + 3 < s.length) bytes += String.fromCharCode(n & 255);
  }
  try {
    return decodeURIComponent(bytes.replace(/[\s\S]/g, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`));
  } catch {
    return null;
  }
}

const clamp = (n: unknown, lo: number, hi: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : null);
const cleanText = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, '').trim().slice(0, max) : '');

export function encodeWorkoutLink(w: WorkoutLink): string {
  return toBase64Url(
    JSON.stringify([LINK_VERSION, cleanText(w.title, TITLE_MAX), w.lifts.slice(0, MAX_LIFTS).map((l) => [l.id, l.name, l.sets, l.reps, l.rest])]),
  );
}

/** null for anything that isn't a well-formed link. Numbers are clamped to sane ranges. */
export function decodeWorkoutLink(payload: string | null | undefined): WorkoutLink | null {
  if (!payload || payload.length > 4000) return null;
  const json = fromBase64Url(payload);
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw[0] !== LINK_VERSION || !Array.isArray(raw[2])) return null;
  const lifts: LinkedLift[] = [];
  for (const l of raw[2].slice(0, MAX_LIFTS)) {
    if (!Array.isArray(l)) return null;
    const id = cleanText(l[0], 60);
    const name = cleanText(l[1], 60);
    const sets = clamp(l[2], 1, 10);
    const reps = clamp(l[3], 1, 50);
    const rest = clamp(l[4], 15, 600);
    if (!/^[a-z0-9-]+$/.test(id) || !name || sets == null || reps == null || rest == null) return null;
    lifts.push({ id, name, sets, reps, rest });
  }
  if (lifts.length === 0) return null;
  return { title: cleanText(raw[1], TITLE_MAX) || 'Shared workout', lifts };
}

/** Reads ?w= from an app or web link. */
export function workoutFromUrl(url: string | null | undefined): WorkoutLink | null {
  const m = url?.match(/[?&#]w=([A-Za-z0-9_-]+)/);
  return m ? decodeWorkoutLink(m[1]) : null;
}

export function workoutUrl(site: string, w: WorkoutLink): string {
  return `${site.replace(/\/?$/, '/')}?w=${encodeWorkoutLink(w)}`;
}

/** A finished workout as a link: each lift once, with its set count and first set's targets. */
export function linkFromSets(
  title: string,
  sets: { exerciseId: string; targetReps: number | null; reps: number | null; restSeconds: number }[],
  name: (id: string) => string,
): WorkoutLink {
  const byLift = new Map<string, typeof sets>();
  for (const s of sets) byLift.set(s.exerciseId, [...(byLift.get(s.exerciseId) ?? []), s]);
  return {
    title,
    lifts: [...byLift].map(([id, ss]) => ({ id, name: name(id), sets: ss.length, reps: ss[0].targetReps ?? ss[0].reps ?? 8, rest: ss[0].restSeconds })),
  };
}

/**
 * Matches each linked lift to the receiver's library, by id and then by name (custom lifts
 * get different ids on each phone). Weights come from the receiver's own history.
 */
export function planFromLink(
  link: WorkoutLink,
  library: Exercise[],
  history: LoggedSet[],
  increment: number,
): { plan: PlannedExercise[]; missing: string[] } {
  const byId = new Map(library.map((e) => [e.id, e]));
  const byName = new Map(library.map((e) => [e.name.toLowerCase(), e]));
  const plan: PlannedExercise[] = [];
  const missing: string[] = [];
  for (const l of link.lifts) {
    const e = byId.get(l.id) ?? byName.get(l.name.toLowerCase());
    if (!e) {
      missing.push(l.name);
      continue;
    }
    const bodyweight = e.equipment === 'bodyweight';
    const next = suggestNext(history, e.id, l.reps, 2, increment);
    plan.push({
      exerciseId: e.id,
      sets: l.sets,
      targetReps: l.reps,
      targetRir: 2,
      suggestedWeight: bodyweight ? null : next.weight,
      restSeconds: l.rest,
      status: next.status,
      deload: next.deload,
      change: bodyweight ? null : next.change,
    });
  }
  return { plan, missing };
}
