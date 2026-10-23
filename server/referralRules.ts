// Pure checks for the creator-code routes, kept apart so they can be tested without a database.
import { createHash } from 'node:crypto';

const CODE = /^[A-Z0-9]{3,20}$/;
const INSTALL = /^[a-z0-9-]{16,64}$/;

export function parseClaim(body: unknown): { code: string; installId: string } | null {
  const b = body as { code?: unknown; installId?: unknown } | null;
  if (typeof b?.code !== 'string' || typeof b.installId !== 'string') return null;
  return CODE.test(b.code) && INSTALL.test(b.installId) ? { code: b.code, installId: b.installId } : null;
}

export const validCode = (code: string | null) => !!code && CODE.test(code);
export const validInstall = (id: unknown): id is string => typeof id === 'string' && INSTALL.test(id);

/**
 * At most `limit` hits per key per window. Stops anyone guessing codes by brute force.
 * Returns false when the caller should be turned away.
 */
export function rateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((h) => t - h < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear();
    return true;
  };
}

const TOKEN = /^[a-f0-9]{32}$/;

export function parseStatsRequest(body: unknown): { code: string; token: string } | null {
  const b = body as { code?: unknown; token?: unknown } | null;
  if (typeof b?.code !== 'string' || typeof b.token !== 'string') return null;
  return CODE.test(b.code) && TOKEN.test(b.token) ? { code: b.code, token: b.token } : null;
}

/** Compares secrets in constant time, so response timing can't leak how much matched. */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Sign-ups per day for the last `days` days (UTC), oldest first. */
export function dailyCounts(createdAt: string[], now: Date, days = 14): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: new Date(now.getTime() - i * 864e5).toISOString().slice(0, 10), count: 0 });
  const index = new Map(out.map((d, i) => [d.day, i]));
  for (const t of createdAt) {
    const i = index.get(t.slice(0, 10));
    if (i != null) out[i].count++;
  }
  return out;
}

export interface Pin {
  /** w = workout, p = plan, c = challenge: the same letters the links use. */
  kind: 'w' | 'p' | 'c';
  payload: string;
  title: string;
}

export const MAX_PINS = 6;
const DEFAULT_TITLE = { w: 'Workout', p: 'Training plan', c: 'Challenge' } as const;

/** A workout, plan or challenge link pasted by a creator, as a pin. null if it isn't one. */
export function pinFromLink(link: unknown): Pin | null {
  if (typeof link !== 'string' || link.length > 6000) return null;
  const m = link.match(/[?&#]([wpc])=([A-Za-z0-9_-]{8,5000})(?=$|[&#\s])/);
  if (!m) return null;
  const kind = m[1] as Pin['kind'];
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(m[2], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw[0] !== 1) return null;
  const title = typeof raw[1] === 'string' ? raw[1].replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
  return { kind, payload: m[2], title: title || DEFAULT_TITLE[kind] };
}

/** The dashboard's "save my page" request. Blank lines are skipped; any bad link fails the lot. */
export function parsePinsRequest(body: unknown): { code: string; token: string; pins: Pin[]; bad: number[] } | null {
  const auth = parseStatsRequest(body);
  const links = (body as { links?: unknown } | null)?.links;
  if (!auth || !Array.isArray(links) || links.length > 50) return null;
  const filled = links.map((l, i) => [l, i] as const).filter(([l]) => typeof l === 'string' && l.trim() !== '');
  const pins: Pin[] = [];
  const bad: number[] = [];
  for (const [l, i] of filled) {
    const pin = pinFromLink((l as string).trim());
    if (pin) pins.push(pin);
    else bad.push(i);
  }
  if (pins.length > MAX_PINS) return null;
  return { ...auth, pins, bad };
}

/** Link opens per day for the last `days` days (UTC), oldest first, from per-day rows. */
export function dailyOpens(rows: { day: string; opens: number }[], now: Date, days = 14): { day: string; count: number }[] {
  const out = dailyCounts([], now, days);
  const index = new Map(out.map((d, i) => [d.day, i]));
  for (const r of rows) {
    const i = index.get(r.day.slice(0, 10));
    if (i != null) out[i].count += r.opens;
  }
  return out;
}

const PUSH_TOKEN = /^Expo(nent)?PushToken\[.+\]$/;

/** The app's "alert me when my creator posts" request. */
export function parsePushRequest(body: unknown): { installId: string; token: string } | null {
  const b = body as { installId?: unknown; token?: unknown } | null;
  if (!validInstall(b?.installId) || typeof b?.token !== 'string' || b.token.length > 200 || !PUSH_TOKEN.test(b.token)) return null;
  return { installId: b.installId as string, token: b.token };
}

/** Pins that weren't on the page before this save. */
export const newPins = (before: Pin[], after: Pin[]) => after.filter((p) => !before.some((b) => b.payload === p.payload));

export const ALERT_GAP_MS = 12 * 60 * 60 * 1000;
export const canAlert = (lastAlertAt: string | null, now: Date) => !lastAlertAt || now.getTime() - Date.parse(lastAlertAt) >= ALERT_GAP_MS;

const KIND_WORD = { w: 'workout', p: 'plan', c: 'challenge' } as const;
const SCREEN = { w: ['/try', 'w'], p: ['/plan', 'p'], c: ['/challenge', 'c'] } as const;

/** The alert followers get, opening the pin in the app when tapped. */
export function pinAlert(creatorName: string, pins: Pin[]) {
  const pin = pins[0];
  const [path, param] = SCREEN[pin.kind];
  return {
    title: pins.length === 1 ? `${creatorName} posted a new ${KIND_WORD[pin.kind]}` : `${creatorName} posted ${pins.length} new things`,
    body: pins.length === 1 ? pin.title : pins.map((p) => p.title).join(', '),
    data: { kind: 'creator', path, params: { [param]: pin.payload } },
  };
}

/** Expo takes at most 100 messages per request. */
export function chunks<T>(list: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** A pin's key in creator_pin_uses: the link data hashed, so rows stay small. */
export const pinHash = (payload: string) => createHash('sha256').update(payload).digest('hex');

/** The app's "I started this" report. */
export function parseUseRequest(body: unknown): { installId: string; payload: string } | null {
  const b = body as { installId?: unknown; payload?: unknown } | null;
  if (!validInstall(b?.installId) || typeof b?.payload !== 'string' || !/^[A-Za-z0-9_-]{8,5000}$/.test(b.payload)) return null;
  return { installId: b.installId as string, payload: b.payload };
}

/** Each pin with how many followers used it. */
export function pinsWithUses(pins: Pin[], rows: { pin_hash: string }[]): (Pin & { uses: number })[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.pin_hash, (counts.get(r.pin_hash) ?? 0) + 1);
  return pins.map((p) => ({ ...p, uses: counts.get(pinHash(p.payload)) ?? 0 }));
}

const NICKNAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$/;
// Kept short on purpose: obvious slurs and impersonation. The creator can ask for a name to be removed.
const BLOCKED = /(admin|liftlab|official|nigg|fag|retard|cunt)/i;

/** A follower joining their creator's weekly leaderboard. */
export function parseCrewJoin(body: unknown): { installId: string; nickname: string } | null {
  const b = body as { installId?: unknown; nickname?: unknown } | null;
  if (!validInstall(b?.installId) || typeof b?.nickname !== 'string') return null;
  const nickname = b.nickname.trim().replace(/\s+/g, ' ');
  return NICKNAME.test(nickname) && !BLOCKED.test(nickname) ? { installId: b.installId as string, nickname } : null;
}

/** A follower's training days so far this week. */
export function parseCrewSync(body: unknown): { installId: string; days: number } | null {
  const b = body as { installId?: unknown; days?: unknown } | null;
  if (!validInstall(b?.installId) || typeof b?.days !== 'number' || !Number.isInteger(b.days) || b.days < 0 || b.days > 7) return null;
  return { installId: b.installId as string, days: b.days };
}

/** Monday (UTC) of the week `now` falls in, as YYYY-MM-DD: the leaderboard's week. */
export function crewWeek(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface CrewRow {
  install_id: string;
  nickname: string;
  days: number;
  updated_at: string;
}

/**
 * The week's board: the top `size` by training days (ties share a place; whoever got there first
 * is listed first), plus the asker's own place if they're further down. Install ids never leave.
 */
export function crewBoard(rows: CrewRow[], me: string, size = 10) {
  const sorted = rows.filter((r) => r.days > 0 || r.install_id === me).sort((a, b) => b.days - a.days || a.updated_at.localeCompare(b.updated_at));
  const placed = sorted.map((r) => ({ place: 1 + sorted.findIndex((x) => x.days === r.days), nickname: r.nickname, days: r.days, me: r.install_id === me }));
  const top = placed.slice(0, size);
  const mine = placed.find((p) => p.me) ?? null;
  return { top, me: mine, total: placed.filter((p) => p.days > 0).length };
}

/** A crew member's id on the dashboard: derived from the install id, which never leaves the server. */
export const crewMemberId = (installId: string) => pinHash(`crew:${installId}`).slice(0, 16);

/** The creator hiding or un-hiding a nickname. */
export function parseCrewHide(body: unknown): { code: string; token: string; id: string; hidden: boolean } | null {
  const auth = parseStatsRequest(body);
  const b = body as { id?: unknown; hidden?: unknown } | null;
  if (!auth || typeof b?.id !== 'string' || !/^[a-f0-9]{16}$/.test(b.id) || typeof b.hidden !== 'boolean') return null;
  return { ...auth, id: b.id, hidden: b.hidden };
}
