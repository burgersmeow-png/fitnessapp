// A small Stripe REST client: form-encoded requests, webhook signature checks and
// subscription state. Plain fetch and node:crypto, so the server needs no Stripe package.
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = (process.env.STRIPE_API_URL ?? 'https://api.stripe.com').replace(/\/$/, '');

type Param = string | number | boolean | null | undefined | Param[] | { [key: string]: Param };

/** Stripe's form encoding: { a: { b: 1 }, c: [{ d: 2 }] } → a[b]=1&c[0][d]=2. Skips null and undefined. */
export function formEncode(params: Record<string, Param>): string {
  const out = new URLSearchParams();
  const walk = (key: string, value: Param) => {
    if (value == null) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${key}[${i}]`, v));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(`${key}[${k}]`, v);
    else out.append(key, String(value));
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out.toString();
}

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function stripe<T>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, Param> = {}): Promise<T> {
  const body = formEncode(params);
  const res = await fetch(`${API}/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'GET' ? undefined : body,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe request failed (${res.status})`, res.status);
  return json;
}

/**
 * Checks a Stripe-Signature header ("t=…,v1=…") against the raw body, and rejects
 * signatures older than `toleranceSec` so a captured webhook can't be replayed later.
 */
export function verifySignature(payload: string, header: string, secret: string, nowSec = Date.now() / 1000, toleranceSec = 300): boolean {
  const parts = header.split(',').map((p) => p.split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  if (!t || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex'));
  return parts
    .filter(([k]) => k === 'v1')
    .some(([, sig]) => {
      const got = Buffer.from(sig ?? '');
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
}

/** Builds a header the way Stripe signs, for tests and the stand-in Stripe. */
export const signPayload = (payload: string, secret: string, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

/** The parts of a Stripe Subscription we keep. */
export interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  /** Older API versions. */
  current_period_end?: number;
  /** Newer API versions keep the period on each item. */
  items?: { data: { current_period_end?: number }[] };
  metadata?: Record<string, string>;
}

export type PaidStatus = 'none' | 'active' | 'past_due' | 'canceled';

/** What the coaching row should say about a subscription. */
export function paidState(sub: StripeSubscription): { paid_status: PaidStatus; paid_until: string | null; cancels_at_period_end: boolean } {
  const end = sub.current_period_end ?? sub.items?.data[0]?.current_period_end;
  const status: PaidStatus =
    sub.status === 'active' || sub.status === 'trialing'
      ? 'active'
      : sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'incomplete'
        ? 'past_due'
        : 'canceled';
  return { paid_status: status, paid_until: end ? new Date(end * 1000).toISOString() : null, cancels_at_period_end: !!sub.cancel_at_period_end };
}
