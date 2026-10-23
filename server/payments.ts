// Paid coaching through Stripe Connect. Coaches connect a Stripe Express account to get paid;
// clients subscribe monthly on Stripe's own checkout page, with the money going to the coach.
// Only this server writes payment state (with the Supabase service_role key), and only after
// Stripe confirms it, so the app can never mark anyone as paid.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { baseUrl, BodyTooLarge, readText, send } from './http';
import { paidState, stripe, StripeError, verifySignature, type StripeSubscription } from './stripe';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
// Your cut of each payment, if any. 0 means coaches keep everything after Stripe's fees.
const FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);

export const paymentsConfigured = () => !!(process.env.STRIPE_SECRET_KEY && WEBHOOK_SECRET && SUPABASE_URL && SERVICE_KEY);

const admin = () => createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

/** The signed-in app user, from the Supabase access token the app sends. */
async function caller(req: IncomingMessage): Promise<string | null> {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user?.id ?? null;
}

/** A plain page to land on after Stripe, telling the user to go back to the app. */
function page(res: ServerResponse, message: string) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font:17px -apple-system,system-ui,sans-serif;background:#0E0F12;color:#F4F5F7;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">
<div><p style="font-size:22px;font-weight:700">${message}</p><p style="color:#9AA0AB">You can close this page and go back to LiftLab.</p></div>`);
}

const PAGES: Record<string, string> = {
  connected: 'Payout details saved',
  expired: 'That link expired. Tap “Set up payouts” in the app again.',
  subscribed: 'You’re subscribed',
  canceled: 'No payment was taken',
};

type Payouts = { coach: string; stripe_account: string | null; charges_enabled: boolean; price_cents: number | null; currency: string };

async function loadPayouts(coach: string): Promise<Payouts | null> {
  const { data } = await admin().from('coach_payouts').select('coach, stripe_account, charges_enabled, price_cents, currency').eq('coach', coach).maybeSingle();
  return data as Payouts | null;
}

async function saveSubscription(coach: string, client: string, sub: StripeSubscription) {
  await admin()
    .from('coaching')
    .update({ ...paidState(sub), stripe_subscription: sub.id })
    .eq('coach', coach)
    .eq('client', client);
}

/** Routes /pay/*. Returns false when the path isn't a payments route. */
export async function handlePayments(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/pay/')) return false;
  if (req.method === 'GET' && url.pathname === '/pay/page') return page(res, PAGES[url.searchParams.get('msg') ?? ''] ?? 'Done'), true;
  if (!paymentsConfigured()) {
    send(res, 503, { error: 'Payments aren’t set up on the server yet.' });
    return true;
  }
  try {
    if (req.method === 'POST' && url.pathname === '/pay/webhook') return await webhook(req, res), true;
    if (req.method !== 'POST') return send(res, 404, { error: 'Not found' }), true;
    const me = await caller(req);
    if (!me) return send(res, 401, { error: 'Sign in again.' }), true;
    const text = await readText(req, 4096);
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    switch (url.pathname) {
      case '/pay/connect':
        return await connect(req, res, me), true;
      case '/pay/status':
        return await status(res, me), true;
      case '/pay/subscribe':
        return await subscribe(req, res, me), true;
      case '/pay/cancel':
        return await cancel(res, me, body), true;
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    if (e instanceof SyntaxError) send(res, 400, { error: 'Bad request' });
    else if (e instanceof BodyTooLarge) send(res, 413, { error: 'Too large' });
    else if (e instanceof StripeError) send(res, 502, { error: e.message });
    else {
      console.error(e);
      send(res, 500, { error: 'Something went wrong. Try again.' });
    }
  }
  return true;
}

/** Coach: creates their Stripe Express account the first time, and returns Stripe's onboarding link. */
async function connect(req: IncomingMessage, res: ServerResponse, me: string) {
  const { data: code } = await admin().from('coach_codes').select('coach').eq('coach', me).maybeSingle();
  if (!code) return send(res, 403, { error: 'Turn on coach mode first.' });
  let account = (await loadPayouts(me))?.stripe_account;
  if (!account) {
    const created = await stripe<{ id: string }>('POST', 'accounts', {
      type: 'express',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { coach: me },
    });
    account = created.id;
    await admin().from('coach_payouts').upsert({ coach: me, stripe_account: account }, { onConflict: 'coach' });
  }
  const link = await stripe<{ url: string }>('POST', 'account_links', {
    account,
    type: 'account_onboarding',
    refresh_url: `${baseUrl(req)}/pay/page?msg=expired`,
    return_url: `${baseUrl(req)}/pay/page?msg=connected`,
  });
  send(res, 200, { url: link.url });
}

/** Coach: re-reads their account from Stripe, so the app knows when payments are switched on. */
async function status(res: ServerResponse, me: string) {
  const payouts = await loadPayouts(me);
  if (!payouts?.stripe_account) return send(res, 200, { connected: false, chargesEnabled: false });
  const account = await stripe<{ charges_enabled: boolean; details_submitted: boolean }>('GET', `accounts/${payouts.stripe_account}`);
  await admin().from('coach_payouts').update({ charges_enabled: account.charges_enabled, updated_at: new Date().toISOString() }).eq('coach', me);
  send(res, 200, { connected: account.details_submitted, chargesEnabled: account.charges_enabled });
}

/** Client: returns a Stripe checkout link for a monthly subscription to their coach. */
async function subscribe(req: IncomingMessage, res: ServerResponse, me: string) {
  const { data: pair } = await admin().from('coaching').select('coach, paid_status').eq('client', me).maybeSingle();
  if (!pair) return send(res, 404, { error: 'Join a coach first.' });
  if (pair.paid_status === 'active') return send(res, 409, { error: 'You’re already subscribed.' });
  const payouts = await loadPayouts(pair.coach);
  if (!payouts?.stripe_account || !payouts.charges_enabled || !payouts.price_cents) {
    return send(res, 409, { error: 'Your coach isn’t taking payments yet.' });
  }
  const { data: profile } = await admin().from('profiles').select('username').eq('id', pair.coach).single();
  const metadata = { coach: pair.coach, client: me };
  const session = await stripe<{ url: string }>('POST', 'checkout/sessions', {
    mode: 'subscription',
    client_reference_id: me,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payouts.currency,
          unit_amount: payouts.price_cents,
          recurring: { interval: 'month' },
          product_data: { name: `Coaching with @${profile?.username ?? 'your coach'}` },
        },
      },
    ],
    subscription_data: {
      transfer_data: { destination: payouts.stripe_account },
      application_fee_percent: FEE_PERCENT > 0 ? FEE_PERCENT : undefined,
      metadata,
    },
    metadata,
    success_url: `${baseUrl(req)}/pay/page?msg=subscribed`,
    cancel_url: `${baseUrl(req)}/pay/page?msg=canceled`,
  });
  send(res, 200, { url: session.url });
}

/**
 * Stops a subscription, or with `resume` undoes a cancel that hasn't happened yet.
 * The client can cancel at the end of the paid month; leaving the coach,
 * or the coach removing the client, ends it straight away so nobody pays for coaching that's over.
 */
async function cancel(res: ServerResponse, me: string, body: Record<string, unknown>) {
  const client = typeof body.client === 'string' ? body.client : me;
  const { data: pair } = await admin().from('coaching').select('coach, client, stripe_subscription').eq('client', client).maybeSingle();
  if (!pair || (me !== pair.client && me !== pair.coach)) return send(res, 404, { error: 'Not found' });
  if (!pair.stripe_subscription) return send(res, 200, { ok: true });
  const sub =
    body.now === true
      ? await stripe<StripeSubscription>('DELETE', `subscriptions/${pair.stripe_subscription}`)
      : await stripe<StripeSubscription>('POST', `subscriptions/${pair.stripe_subscription}`, { cancel_at_period_end: body.resume !== true });
  await saveSubscription(pair.coach, pair.client, sub);
  send(res, 200, { ok: true });
}

/** Stripe tells us about payments here. The signature proves the event came from Stripe. */
async function webhook(req: IncomingMessage, res: ServerResponse) {
  const raw = await readText(req, 512 * 1024);
  if (!verifySignature(raw, String(req.headers['stripe-signature'] ?? ''), WEBHOOK_SECRET!)) return send(res, 400, { error: 'Bad signature' });
  const event = JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      const meta = obj.metadata as Record<string, string> | undefined;
      if (obj.mode === 'subscription' && meta?.coach && meta.client && typeof obj.subscription === 'string') {
        await saveSubscription(meta.coach, meta.client, await stripe<StripeSubscription>('GET', `subscriptions/${obj.subscription}`));
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = obj as unknown as StripeSubscription;
      if (sub.metadata?.coach && sub.metadata.client) await saveSubscription(sub.metadata.coach, sub.metadata.client, sub);
      break;
    }
    case 'account.updated':
      await admin()
        .from('coach_payouts')
        .update({ charges_enabled: !!obj.charges_enabled, updated_at: new Date().toISOString() })
        .eq('stripe_account', obj.id as string);
      break;
  }
  send(res, 200, { received: true });
}
