// Push alerts between coaches and clients, sent through Expo's free push service.
// The app tells us what it just did (sent a message, assigned or finished a workout); we look the
// row up ourselves, check the caller really did it and is still in that coaching pair, and only
// then alert the other person. So the app can't push arbitrary text to anyone.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readText, send } from './http';
import { assignmentAlert, doneAlert, messageAlert, type Alert } from './pushMessages';
import { admin, caller, databaseConfigured } from './supabase';

const EXPO_PUSH = process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send';
// Alerts are only for things that just happened, so an old id can't be replayed for spam.
const FRESH_MS = 10 * 60_000;
const sent = new Set<string>();

export const pushConfigured = databaseConfigured;

const fresh = (iso: string | null) => !!iso && Date.now() - Date.parse(iso) < FRESH_MS;

async function nameOf(id: string): Promise<string> {
  const { data } = await admin().from('profiles').select('display_name').eq('id', id).single();
  return data?.display_name ?? 'Your coach';
}

async function stillPaired(coach: string, client: string): Promise<boolean> {
  const { data } = await admin().from('coaching').select('client').eq('coach', coach).eq('client', client).maybeSingle();
  return !!data;
}

/** Sends to every phone the person is signed in on, and forgets phones that no longer exist. */
async function deliver(to: string, alert: Alert): Promise<number> {
  const { data: rows } = await admin().from('push_tokens').select('token').eq('user_id', to);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (!tokens.length) return 0;
  const res = await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(tokens.map((t) => ({ to: t, sound: 'default', ...alert, data: { ...alert.data, kind: 'coach' } }))),
  });
  if (!res.ok) throw new Error(`Expo push failed (${res.status})`);
  const { data } = (await res.json()) as { data: { status: string; details?: { error?: string } }[] };
  const gone = tokens.filter((_, i) => data[i]?.details?.error === 'DeviceNotRegistered');
  if (gone.length) await admin().from('push_tokens').delete().in('token', gone);
  return tokens.length - gone.length;
}

/** Routes /push/*. Returns false when the path isn't a push route. */
export async function handlePush(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/push/')) return false;
  if (!pushConfigured()) return send(res, 503, { error: 'Push isn’t set up on the server yet.' }), true;
  if (req.method !== 'POST' || url.pathname !== '/push/notify') return send(res, 404, { error: 'Not found' }), true;
  try {
    const me = await caller(req);
    if (!me) return send(res, 401, { error: 'Sign in again.' }), true;
    const { type, id } = JSON.parse((await readText(req, 1024)) || '{}') as { type?: string; id?: number };
    if (!Number.isInteger(id) || !['message', 'assignment', 'done'].includes(type ?? '')) return send(res, 400, { error: 'Bad request' }), true;
    const key = `${type}:${id}`;
    if (sent.has(key)) return send(res, 200, { sent: 0 }), true;

    let target: { to: string; alert: Alert } | null = null;
    if (type === 'message') {
      const { data: m } = await admin().from('messages').select('coach, client, sender, text, created_at').eq('id', id).maybeSingle();
      if (m && m.sender === me && fresh(m.created_at) && (await stillPaired(m.coach, m.client))) {
        target = { to: me === m.coach ? m.client : m.coach, alert: messageAlert(m, await nameOf(me)) };
      }
    } else {
      const { data: a } = await admin().from('assignments').select('coach, client, title, scheduled_for, created_at, completed_at').eq('id', id).maybeSingle();
      if (a && (await stillPaired(a.coach, a.client))) {
        if (type === 'assignment' && a.coach === me && fresh(a.created_at)) {
          target = { to: a.client, alert: assignmentAlert(a, await nameOf(me), new Date()) };
        } else if (type === 'done' && a.client === me && fresh(a.completed_at)) {
          target = { to: a.coach, alert: doneAlert(a, await nameOf(me)) };
        }
      }
    }
    if (!target) return send(res, 404, { error: 'Nothing to send' }), true;
    sent.add(key);
    send(res, 200, { sent: await deliver(target.to, target.alert) });
  } catch (e) {
    if (e instanceof SyntaxError) send(res, 400, { error: 'Bad request' });
    else {
      console.error(e);
      send(res, 502, { error: 'Couldn’t send the alert.' });
    }
  }
  return true;
}
