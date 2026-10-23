// What a follower's creator has pinned (set on the creator's dashboard), shown on Today. Pure.

import type { CardContent } from './shareCard';
export interface Pin {
  /** w = workout, p = plan, c = challenge: the same letters the links use. */
  kind: 'w' | 'p' | 'c';
  payload: string;
  title: string;
}

export interface CreatorFeed {
  name: string;
  pins: Pin[];
  /** Payloads the follower has opened, so new pins can be marked. */
  seen: string[];
  /** When the server was last asked (ISO). */
  checkedAt: string;
}

export const FEED_MAX = 6;
/** Ask the server at most this often. */
export const FEED_REFRESH_MS = 60 * 60 * 1000;

const KINDS = new Set(['w', 'p', 'c']);

/** Pins from the server, with anything malformed dropped. */
export function cleanPins(raw: unknown): Pin[] {
  if (!Array.isArray(raw)) return [];
  const out: Pin[] = [];
  for (const p of raw) {
    const r = p as Partial<Pin> | null;
    if (!r || !KINDS.has(r.kind as string) || typeof r.payload !== 'string' || !/^[A-Za-z0-9_-]{8,5000}$/.test(r.payload)) continue;
    const title = typeof r.title === 'string' ? r.title.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
    out.push({ kind: r.kind as Pin['kind'], payload: r.payload, title: title || KIND_LABEL[r.kind as Pin['kind']] });
    if (out.length === FEED_MAX) break;
  }
  return out;
}

export const KIND_LABEL = { w: 'Workout', p: 'Plan', c: 'Challenge' } as const;

/** The app screen a pin opens. */
export function pinRoute(pin: Pin): { pathname: '/try' | '/plan' | '/challenge'; params: Record<string, string> } {
  if (pin.kind === 'w') return { pathname: '/try', params: { w: pin.payload } };
  if (pin.kind === 'p') return { pathname: '/plan', params: { p: pin.payload } };
  return { pathname: '/challenge', params: { c: pin.payload } };
}

export const isNew = (feed: CreatorFeed, pin: Pin) => !feed.seen.includes(pin.payload);

/** Whether it's time to ask the server again. */
export const feedStale = (feed: CreatorFeed | null, now: Date) => !feed || now.getTime() - Date.parse(feed.checkedAt) >= FEED_REFRESH_MS;

/**
 * The feed after a fresh fetch. The first time, everything counts as seen (it's not "new" to
 * someone who just arrived); after that only pins that weren't there before are new.
 */
export function mergeFeed(prev: CreatorFeed | null, name: string, pins: Pin[], now: Date): CreatorFeed {
  const seen = prev ? prev.seen.filter((s) => pins.some((p) => p.payload === s)) : pins.map((p) => p.payload);
  return { name, pins, seen, checkedAt: now.toISOString() };
}

export const markSeen = (feed: CreatorFeed, pin: Pin): CreatorFeed =>
  feed.seen.includes(pin.payload) ? feed : { ...feed, seen: [...feed.seen, pin.payload] };

/** What a new follower should start with: the creator's plan if they pinned one, else a workout, else a challenge. */
export function starterPin(pins: Pin[]): Pin | null {
  return pins.find((p) => p.kind === 'p') ?? pins.find((p) => p.kind === 'w') ?? pins.find((p) => p.kind === 'c') ?? null;
}

export function starterLabel(name: string, pin: Pin): string {
  const verb = { p: 'Follow', w: 'Start', c: 'Join' }[pin.kind];
  return `${verb} ${name}’s ${pin.title}`;
}

export interface CrewPlaceLike {
  place: number;
  nickname: string;
  days: number;
  me: boolean;
}

/** The story card for someone's place on their creator's weekly leaderboard. */
export function crewCardContent(creator: string, me: CrewPlaceLike, top: CrewPlaceLike[], total: number): CardContent {
  return {
    eyebrow: `${creator.toUpperCase()}’S CREW · THIS WEEK`,
    headline: me.place === 1 ? 'TOP OF THE CREW' : `#${me.place} IN THE CREW`,
    stats: [
      { value: `#${me.place}`, label: 'PLACE' },
      { value: String(me.days), label: me.days === 1 ? 'TRAINING DAY' : 'TRAINING DAYS' },
      { value: String(Math.max(total, 1)), label: 'IN THE CREW' },
    ],
    // The top three, with me swapped in for the third if I'm not already there.
    lines: (top.slice(0, 3).some((p) => p.me) ? top.slice(0, 3) : [...top.slice(0, 2), me]).map((p) => ({ name: `${p.place}. ${p.nickname}${p.me ? ' (me)' : ''}`, detail: `${p.days} ${p.days === 1 ? 'day' : 'days'}`, pr: p.me })),
    more: 0,
    footer: `Train with ${creator} on LiftLab`,
  };
}
