// Social feed shapes and maths. Pure: no network here (see src/services/social.ts).
import type { CardioType } from './cardio';

export interface Profile {
  id: string;
  username: string;
  displayName: string;
}

/** What a shared workout carries. Weights in kg and distance in km, so each viewer sees their own units. */
export type PostBody =
  | {
      minutes: number;
      sets: number;
      volumeKg: number;
      prs: string[];
      exercises: { name: string; sets: number; bestKg: number | null; bestReps: number | null }[];
    }
  | { cardioType: CardioType; minutes: number; distanceKm: number | null };

export interface NewPost {
  clientId: string;
  kind: 'workout' | 'cardio';
  title: string;
  body: PostBody;
  happenedAt: string;
}

export interface FeedPost extends NewPost {
  id: number;
  author: Profile;
  highFives: string[];
  comments: number;
}

export interface Friendship {
  other: Profile;
  status: 'pending' | 'accepted';
  /** True when the other person sent the request (so you can accept it). */
  incoming: boolean;
}

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;

/** Turns what someone typed into a valid username, or null with the reason. */
export function checkUsername(raw: string): { ok: true; username: string } | { ok: false; reason: string } {
  const username = raw.trim().toLowerCase().replace(/^@/, '');
  if (username.length < 3) return { ok: false, reason: 'At least 3 characters.' };
  if (username.length > 20) return { ok: false, reason: 'At most 20 characters.' };
  if (!USERNAME_RULE.test(username)) return { ok: false, reason: 'Letters, numbers and _ only.' };
  return { ok: true, username };
}

/** Monday 00:00 local time of the week containing `now`. */
export function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export interface LeaderRow {
  profile: Profile;
  sessions: number;
  minutes: number;
  volumeKg: number;
}

/**
 * This week's ranking among friends, by sessions then minutes. Ranking by consistency rather than
 * weight lifted keeps it fair between beginners and strong lifters, and between lifting and cardio.
 */
export function weeklyLeaderboard(posts: FeedPost[], people: Profile[], now: Date): LeaderRow[] {
  const from = startOfWeek(now).getTime();
  const rows = new Map(people.map((p) => [p.id, { profile: p, sessions: 0, minutes: 0, volumeKg: 0 }]));
  for (const p of posts) {
    if (Date.parse(p.happenedAt) < from) continue;
    const row = rows.get(p.author.id) ?? { profile: p.author, sessions: 0, minutes: 0, volumeKg: 0 };
    row.sessions += 1;
    row.minutes += p.body.minutes;
    if ('volumeKg' in p.body) row.volumeKg += p.body.volumeKg;
    rows.set(p.author.id, row);
  }
  return [...rows.values()].sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes || a.profile.username.localeCompare(b.profile.username));
}

/** "now", "5m", "3h", "2d", then a short date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.floor((now - Date.parse(iso)) / 6e4);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h`;
  if (min < 7 * 24 * 60) return `${Math.floor(min / 1440)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Two letters for an avatar: "Sam Rivera" → "SR", "sam" → "SA". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** A stable avatar colour per person. */
export function avatarHue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

const partOfDay = (iso: string) => {
  const h = new Date(iso).getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
};

/** "Evening chest & back workout" from the muscles trained most. */
export function workoutTitle(startedAt: string, muscles: string[]): string {
  const top = [...new Set(muscles.map((m) => m.toLowerCase()))].slice(0, 2);
  return `${partOfDay(startedAt)} ${top.length ? `${top.join(' & ')} ` : ''}workout`;
}

/** "Morning run". */
export const cardioTitle = (startedAt: string, label: string) => `${partOfDay(startedAt)} ${label.toLowerCase()}`;
