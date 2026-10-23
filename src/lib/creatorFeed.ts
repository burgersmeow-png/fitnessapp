// What a follower's creator has pinned (set on the creator's dashboard), shown on Today. Pure.

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
