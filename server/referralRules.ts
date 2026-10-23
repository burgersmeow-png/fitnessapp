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
