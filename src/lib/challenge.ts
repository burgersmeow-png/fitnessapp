// Challenges like "12 workouts in 4 weeks": a creator shares one, followers join from the
// link, and each phone counts its own training days. Pure.
import { dayKey } from './habits';
import { compactNumber, type CardContent } from './shareCard';
import { fromBase64Url, toBase64Url } from './workoutLink';

export interface ChallengeDef {
  title: string;
  /** Training days needed (lifting or cardio; two sessions on one day count once). */
  sessions: number;
  /** How long there is, counting the day you join. */
  days: number;
}

export interface JoinedChallenge extends ChallengeDef {
  /** Local day it started, YYYY-MM-DD. */
  start: string;
}

export const PRESETS: ChallengeDef[] = [
  { title: '7-day kickstart', sessions: 4, days: 7 },
  { title: '12 in 4 weeks', sessions: 12, days: 28 },
  { title: '20 in 30 days', sessions: 20, days: 30 },
  { title: '75 hard-ish', sessions: 60, days: 75 },
];

export const TITLE_MAX = 32;

/** null when the numbers can't work: more sessions than days, or out of range. */
export function cleanChallenge(raw: { title?: unknown; sessions?: unknown; days?: unknown }): ChallengeDef | null {
  const sessions = typeof raw.sessions === 'number' ? Math.round(raw.sessions) : NaN;
  const days = typeof raw.days === 'number' ? Math.round(raw.days) : NaN;
  if (!(days >= 3 && days <= 100) || !(sessions >= 1 && sessions <= days)) return null;
  const title = typeof raw.title === 'string' ? raw.title.replace(/[\u0000-\u001f]/g, '').trim().slice(0, TITLE_MAX) : '';
  return { title: title || `${sessions} in ${days} days`, sessions, days };
}

export const encodeChallenge = (c: ChallengeDef) => toBase64Url(JSON.stringify([1, c.title, c.sessions, c.days]));

export function decodeChallenge(payload: string | null | undefined): ChallengeDef | null {
  if (!payload || payload.length > 400) return null;
  const json = fromBase64Url(payload);
  if (!json) return null;
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw) || raw[0] !== 1) return null;
    return cleanChallenge({ title: raw[1], sessions: raw[2], days: raw[3] });
  } catch {
    return null;
  }
}

export const challengeUrl = (site: string, c: ChallengeDef) => `${site.replace(/\/?$/, '/')}?c=${encodeChallenge(c)}`;

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

export interface ChallengeProgress {
  done: number;
  /** 1 on the day you join. */
  day: number;
  daysLeft: number;
  lastDay: string;
  status: 'active' | 'won' | 'missed';
  /** Where you'd be with sessions spread evenly. */
  onPace: boolean;
}

export function challengeProgress(c: JoinedChallenge, sessionDates: string[], now: Date): ChallengeProgress {
  const lastDay = addDays(c.start, c.days - 1);
  const today = dayKey(now);
  const days = new Set(sessionDates.map((s) => dayKey(new Date(s))).filter((d) => d >= c.start && d <= lastDay));
  const done = days.size;
  const day = Math.min(c.days, Math.max(1, Math.round((Date.parse(today) - Date.parse(c.start)) / 864e5) + 1));
  const over = today > lastDay;
  const status = done >= c.sessions ? 'won' : over || c.sessions - done > c.days - day + (days.has(today) ? 0 : 1) ? 'missed' : 'active';
  return {
    done: Math.min(done, c.sessions),
    day,
    daysLeft: over ? 0 : c.days - day,
    lastDay,
    status,
    onPace: done >= Math.floor((c.sessions * (day - 1)) / c.days),
  };
}

export function challengeCardContent(c: JoinedChallenge, p: ChallengeProgress): CardContent {
  const headline = p.status === 'won' ? 'CHALLENGE WON' : p.status === 'missed' ? 'SO CLOSE' : `DAY ${p.day} OF ${c.days}`;
  return {
    eyebrow: `CHALLENGE · ${c.title.toUpperCase()}`,
    headline,
    stats: [
      { value: `${p.done}/${c.sessions}`, label: 'SESSIONS' },
      { value: String(p.status === 'active' ? p.daysLeft : c.days), label: p.status === 'active' ? 'DAYS LEFT' : 'DAYS' },
      { value: `${compactNumber(Math.round((p.done / c.sessions) * 100))}%`, label: 'DONE' },
    ],
    lines: [
      {
        name: p.status === 'won' ? 'Every session done' : p.status === 'missed' ? `${p.done} of ${c.sessions} sessions` : p.onPace ? 'On pace' : 'Catching up',
        detail: `${c.sessions} training days in ${c.days} days`,
        pr: p.status === 'won',
      },
    ],
    more: 0,
    footer: 'Join me on LiftLab',
  };
}
