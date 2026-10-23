import * as WebBrowser from 'expo-web-browser';
import type { PaidStatus, Subscription } from '../lib/payments';
import { SERVER_URL } from './server';
import { fail, myId, SocialError } from './social';
import { socialConfigured, supabase } from './supabase';

/** Payments need both the online database and the helper server (which holds the Stripe key). */
export const paymentsAvailable = socialConfigured && !!SERVER_URL;

/** Calls the helper server as the signed-in user. */
async function call<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  if (!SERVER_URL) throw new SocialError('Payments aren’t set up yet.');
  const { data } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new SocialError('Couldn’t reach the server. Check your connection and try again.');
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new SocialError(json.error ?? 'Something went wrong. Try again.');
  return json;
}

export interface Payouts {
  priceCents: number | null;
  currency: string;
  connected: boolean;
  chargesEnabled: boolean;
}

/** A coach's own price and payout state. */
export async function loadPayouts(): Promise<Payouts> {
  const { data, error } = await supabase.from('coach_payouts').select('price_cents, currency, stripe_account, charges_enabled').maybeSingle();
  fail(error);
  return {
    priceCents: data?.price_cents ?? null,
    currency: data?.currency ?? 'usd',
    connected: !!data?.stripe_account,
    chargesEnabled: !!data?.charges_enabled,
  };
}

/** Sets the monthly price, or null to coach for free. Existing subscribers keep their price. */
export async function savePrice(cents: number | null): Promise<void> {
  const coach = await myId();
  fail((await supabase.from('coach_payouts').upsert({ coach, price_cents: cents }, { onConflict: 'coach' })).error, 'Couldn’t save the price. Try again.');
}

/** Opens Stripe's sign-up for getting paid, then checks whether payments are switched on. */
export async function setUpPayouts(): Promise<void> {
  const { url } = await call<{ url: string }>('/pay/connect');
  await WebBrowser.openBrowserAsync(url);
  await call('/pay/status');
}

export const refreshPayouts = () => call('/pay/status');

export interface CoachOffer {
  priceCents: number;
  currency: string;
}

/** What your coach charges per month, once they can take payments. */
export async function loadCoachOffer(): Promise<CoachOffer | null> {
  const { data, error } = await supabase.rpc('my_coach_offer');
  fail(error);
  const row = (data as { price_cents: number | null; currency: string; ready: boolean }[] | null)?.[0];
  return row?.ready && row.price_cents ? { priceCents: row.price_cents, currency: row.currency } : null;
}

/** Opens Stripe's checkout for a monthly subscription to your coach. */
export async function subscribeToCoach(): Promise<void> {
  const { url } = await call<{ url: string }>('/pay/subscribe');
  await WebBrowser.openBrowserAsync(url);
}

/** Cancels at the end of the paid month, or straight away with `now`. A coach passes their client's id. */
export const cancelSubscription = (opts: { client?: string; now?: boolean } = {}) => call('/pay/cancel', opts);

export const resumeSubscription = () => call('/pay/cancel', { resume: true });

export type CoachingPaidRow = { paid_status: PaidStatus; paid_until: string | null; cancels_at_period_end: boolean };

export const toSubscription = (r: CoachingPaidRow): Subscription => ({
  status: r.paid_status ?? 'none',
  until: r.paid_until ?? null,
  ending: !!r.cancels_at_period_end,
});
