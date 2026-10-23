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
