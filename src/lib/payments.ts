// Coaching prices and subscription status for display. Pure: calls are in src/services/payments.ts.

export type PaidStatus = 'none' | 'active' | 'past_due' | 'canceled';

export interface Subscription {
  status: PaidStatus;
  /** When the paid month ends. */
  until: string | null;
  /** Cancelled, but paid up until `until`. */
  ending: boolean;
}

/** "$45" or "$45.50" in the phone's own formatting. */
export function formatPrice(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export const MIN_PRICE = 100;
export const MAX_PRICE = 100_000;

/** "45", "$45.50", "45,50" → cents, or null if it isn't a sensible monthly price. */
export function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents >= MIN_PRICE && cents <= MAX_PRICE ? cents : null;
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** A short line about a subscription, and how it should look. */
export function subscriptionLabel(s: Subscription): { text: string; tone: 'good' | 'warn' | 'muted' } {
  if (s.status === 'active' && s.ending) return { text: s.until ? `Ends ${day(s.until)}` : 'Ending', tone: 'warn' };
  if (s.status === 'active') return { text: s.until ? `Paid · renews ${day(s.until)}` : 'Paid', tone: 'good' };
  if (s.status === 'past_due') return { text: 'Payment failed', tone: 'warn' };
  return { text: 'Not subscribed', tone: 'muted' };
}
