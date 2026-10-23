import type { SQLiteDatabase } from 'expo-sqlite';
import type { Assignment, PlanItem } from '../lib/coaching';
import { loadRecord, saveRecord } from '../lib/db';
import type { FeedPost, Profile } from '../lib/social';
import { fail, loadFeed, myId, SocialError, toProfile, type ProfileRow } from './social';
import { supabase } from './supabase';
import { cancelSubscription, toSubscription, type CoachingPaidRow } from './payments';
import type { Subscription } from '../lib/payments';

type AssignmentRow = {
  id: number;
  coach: string;
  client: string;
  title: string;
  note: string;
  plan: PlanItem[];
  scheduled_for: string;
  completed_at: string | null;
};
const toAssignment = (r: AssignmentRow): Assignment => ({
  id: r.id,
  coach: r.coach,
  client: r.client,
  title: r.title,
  note: r.note,
  plan: r.plan,
  scheduledFor: r.scheduled_for,
  completedAt: r.completed_at,
});

/** Turns on coach mode and returns your invite code (the same one every time). */
export async function myCoachCode(): Promise<string> {
  const { data, error } = await supabase.rpc('coach_code');
  fail(error);
  return data as string;
}

/** Your coach-code, if coach mode is on. */
export async function existingCoachCode(): Promise<string | null> {
  const { data, error } = await supabase.from('coach_codes').select('code').maybeSingle();
  fail(error);
  return data?.code ?? null;
}

export async function joinCoach(code: string): Promise<void> {
  const { error } = await supabase.rpc('join_coach', { invite: code });
  if (error?.code === 'P0002') throw new SocialError('No coach has that code. Check it and try again.');
  if (error?.code === '22023') throw new SocialError('That’s your own code. Share it with your clients.');
  if (error?.code === '23505') throw new SocialError('You already have a coach. Leave them first to join someone else.');
  fail(error);
}

/** Who coaches you, and who you coach, with each pair's subscription. */
export async function loadCoaching(): Promise<{
  coach: Profile | null;
  mySubscription: Subscription;
  clients: Profile[];
  clientSubscriptions: Map<string, Subscription>;
}> {
  const me = await myId();
  const { data, error } = await supabase
    .from('coaching')
    .select(
      'coach, client, paid_status, paid_until, cancels_at_period_end, c:profiles!coaching_coach_fkey(id, username, display_name), cl:profiles!coaching_client_fkey(id, username, display_name)',
    );
  fail(error);
  const rows = data ?? [];
  const asClient = rows.find((r) => r.client === me);
  return {
    coach: asClient ? toProfile(asClient.c as unknown as ProfileRow) : null,
    mySubscription: asClient ? toSubscription(asClient as CoachingPaidRow) : { status: 'none', until: null, ending: false },
    clients: rows.filter((r) => r.coach === me).map((r) => toProfile(r.cl as unknown as ProfileRow)),
    clientSubscriptions: new Map(rows.filter((r) => r.coach === me).map((r) => [r.client, toSubscription(r as CoachingPaidRow)])),
  };
}

/** Ends a coaching relationship, from either side. Any subscription stops first, so nobody pays for coaching that's over. */
export async function endCoaching(coach: string, client: string): Promise<void> {
  const { data } = await supabase.from('coaching').select('paid_status').eq('coach', coach).eq('client', client).maybeSingle();
  if (data && data.paid_status !== 'none' && data.paid_status !== 'canceled') await cancelSubscription({ client, now: true });
  fail((await supabase.from('coaching').delete().eq('coach', coach).eq('client', client)).error);
}

/** Assignments you can see (yours as a client, or your clients' as a coach), newest first. */
export async function loadAssignments(client?: string): Promise<Assignment[]> {
  let q = supabase.from('assignments').select('id, coach, client, title, note, plan, scheduled_for, completed_at').order('scheduled_for', { ascending: false }).limit(200);
  if (client) q = q.eq('client', client);
  const { data, error } = await q;
  fail(error);
  return (data ?? []).map(toAssignment);
}

export async function assignWorkout(a: { client: string; title: string; note: string; plan: PlanItem[]; scheduledFor: string }): Promise<void> {
  const coach = await myId();
  fail(
    (await supabase.from('assignments').insert({ coach, client: a.client, title: a.title.trim(), note: a.note.trim(), plan: a.plan, scheduled_for: a.scheduledFor })).error,
    'Couldn’t send the workout. Try again.',
  );
}

export async function removeAssignment(id: number): Promise<void> {
  fail((await supabase.from('assignments').delete().eq('id', id)).error);
}

/** Your clients' sessions from the last 30 days (coaches see coach-only sessions too). */
export async function loadClientSessions(): Promise<FeedPost[]> {
  return loadFeed(new Date(Date.now() - 30 * 864e5), 1000);
}

export interface Message {
  id: number;
  sender: string;
  text: string;
  createdAt: string;
}

export async function loadMessages(coach: string, client: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender, text, created_at')
    .eq('coach', coach)
    .eq('client', client)
    .order('created_at', { ascending: false })
    .limit(200);
  fail(error);
  return (data ?? []).reverse().map((r) => ({ id: r.id, sender: r.sender, text: r.text, createdAt: r.created_at }));
}

export async function sendMessage(coach: string, client: string, text: string): Promise<void> {
  fail((await supabase.from('messages').insert({ coach, client, text: text.trim() })).error, 'Couldn’t send. Try again.');
}

// Ticking off an assignment. The workout started from it is remembered on the phone, so finishing
// that workout marks the assignment done (later, if there's no signal at the time).

const ACTIVE = 'activeAssignment';
const DONE_QUEUE = 'assignmentsDone';

export async function rememberAssignment(db: SQLiteDatabase, assignmentId: number, workoutId: number): Promise<void> {
  await saveRecord(db, ACTIVE, { assignmentId, workoutId });
}

/** Call when a workout finishes. Marks its assignment done if it came from one. */
export async function finishAssignedWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  const active = await loadRecord<{ assignmentId: number; workoutId: number }>(db, ACTIVE);
  if (!active || active.workoutId !== workoutId) return;
  await saveRecord(db, ACTIVE, null);
  const done = (await loadRecord<{ id: number; at: string }[]>(db, DONE_QUEUE)) ?? [];
  await saveRecord(db, DONE_QUEUE, [...done, { id: active.assignmentId, at: new Date().toISOString() }]);
  await flushAssignmentsDone(db);
}

export async function flushAssignmentsDone(db: SQLiteDatabase): Promise<void> {
  const done = (await loadRecord<{ id: number; at: string }[]>(db, DONE_QUEUE)) ?? [];
  if (!done.length) return;
  const left = [];
  for (const d of done) {
    const { error } = await supabase.from('assignments').update({ completed_at: d.at }).eq('id', d.id);
    if (error) left.push(d);
  }
  await saveRecord(db, DONE_QUEUE, left.length ? left : null);
}
