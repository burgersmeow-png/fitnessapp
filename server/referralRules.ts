// Pure checks for the creator-code routes, kept apart so they can be tested without a database.

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
