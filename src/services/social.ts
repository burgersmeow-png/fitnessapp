import type { SQLiteDatabase } from 'expo-sqlite';
import { loadRecord, saveRecord } from '../lib/db';
import type { FeedPost, Friendship, NewPost, PostBody, Profile } from '../lib/social';
import { unregisterPush } from './push';
import { socialConfigured, supabase } from './supabase';

export class SocialError extends Error {}

const QUEUE = 'socialQueue';
type QueuedPost = NewPost & { visibility?: 'friends' | 'coach' };

export function fail(error: { message: string; code?: string } | null, friendly?: string): void {
  if (!error) return;
  if (error.message?.includes('Failed to fetch') || error.message?.includes('Network request failed')) {
    throw new SocialError('You’re offline. Try again when you have signal.');
  }
  throw new SocialError(friendly ?? 'Something went wrong. Try again.');
}

export type ProfileRow = { id: string; username: string; display_name: string };
export const toProfile = (r: ProfileRow): Profile => ({ id: r.id, username: r.username, displayName: r.display_name });

export async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new SocialError('Sign in first.');
  return data.session.user.id;
}

// Accounts

export async function signUp(email: string, password: string): Promise<'signedIn' | 'checkEmail'> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error?.message.toLowerCase().includes('already registered')) throw new SocialError('That email already has an account. Sign in instead.');
  if (error?.message.toLowerCase().includes('password')) throw new SocialError('Use a password of at least 8 characters.');
  fail(error, 'Couldn’t create the account. Check the email and try again.');
  return data.session ? 'signedIn' : 'checkEmail';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error?.message.toLowerCase().includes('invalid')) throw new SocialError('Wrong email or password.');
  if (error?.message.toLowerCase().includes('not confirmed')) throw new SocialError('Confirm your email first, using the link we sent.');
  fail(error, 'Couldn’t sign in. Try again.');
}

export async function signOut(): Promise<void> {
  // Stop this phone getting the account's coach alerts before the sign-in goes.
  await unregisterPush().catch(() => {});
  await supabase.auth.signOut();
}

/** Deletes the account and everything shared from it. Workouts on this phone stay. */
export async function deleteAccount(): Promise<void> {
  fail((await supabase.rpc('delete_account')).error, 'Couldn’t delete the account. Try again.');
  await supabase.auth.signOut();
}

export async function loadMyProfile(): Promise<Profile | null> {
  const id = await myId();
  const { data, error } = await supabase.from('profiles').select('id, username, display_name').eq('id', id).maybeSingle();
  fail(error);
  return data ? toProfile(data) : null;
}

export async function createProfile(username: string, displayName: string): Promise<void> {
  const id = await myId();
  const { error } = await supabase.from('profiles').insert({ id, username, display_name: displayName.trim() || username });
  if (error?.code === '23505') throw new SocialError('That username is taken. Try another.');
  fail(error);
}

// Friends

export async function findPeople(query: string): Promise<Profile[]> {
  const q = query.trim().toLowerCase().replace(/^@/, '').replace(/[%_\\]/g, (c) => `\\${c}`);
  if (q.length < 2) return [];
  const id = await myId();
  const { data, error } = await supabase.from('profiles').select('id, username, display_name').ilike('username', `${q}%`).neq('id', id).limit(20);
  fail(error);
  return (data ?? []).map(toProfile);
}

export async function loadFriendships(): Promise<Friendship[]> {
  const id = await myId();
  const { data, error } = await supabase
    .from('friendships')
    .select('requester, addressee, status, req:profiles!friendships_requester_fkey(id, username, display_name), adr:profiles!friendships_addressee_fkey(id, username, display_name)')
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []).map((r) => {
    const incoming = r.addressee === id;
    const other = (incoming ? r.req : r.adr) as unknown as ProfileRow;
    return { other: toProfile(other), status: r.status as Friendship['status'], incoming };
  });
}

export async function addFriend(other: string): Promise<void> {
  const id = await myId();
  const { error } = await supabase.from('friendships').insert({ requester: id, addressee: other });
  if (error?.code === '23505') {
    // They already asked us: accepting is what the person meant.
    const accept = await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', other).eq('addressee', id);
    fail(accept.error);
    return;
  }
  fail(error);
}

export async function acceptFriend(other: string): Promise<void> {
  const id = await myId();
  fail((await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', other).eq('addressee', id)).error);
}

export async function removeFriend(other: string): Promise<void> {
  const id = await myId();
  fail((await supabase.from('friendships').delete().or(`and(requester.eq.${id},addressee.eq.${other}),and(requester.eq.${other},addressee.eq.${id})`)).error);
}

// Feed

type PostRow = {
  id: number;
  client_id: string;
  kind: 'workout' | 'cardio';
  title: string;
  body: PostBody;
  happened_at: string;
  author: ProfileRow;
  high_fives: { user_id: string }[];
  comments: { count: number }[];
};

const POST_COLUMNS =
  'id, client_id, kind, title, body, happened_at, author:profiles!posts_user_id_fkey(id, username, display_name), high_fives(user_id), comments(count)';

const toPost = (r: PostRow): FeedPost => ({
  id: r.id,
  clientId: r.client_id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  happenedAt: r.happened_at,
  author: toProfile(r.author),
  highFives: r.high_fives.map((h) => h.user_id),
  comments: r.comments[0]?.count ?? 0,
});

/** Your posts and your friends', newest first. `since` limits how far back. */
export async function loadFeed(since?: Date, limit = 50): Promise<FeedPost[]> {
  let q = supabase.from('posts').select(POST_COLUMNS).order('happened_at', { ascending: false }).limit(limit);
  if (since) q = q.gte('happened_at', since.toISOString());
  const { data, error } = await q;
  fail(error);
  return ((data ?? []) as unknown as PostRow[]).map(toPost);
}

/** One post, or null if it was removed or isn't visible to you. */
export async function loadPost(id: number): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_COLUMNS).eq('id', id).maybeSingle();
  fail(error);
  return data ? toPost(data as unknown as PostRow) : null;
}

export async function setHighFive(postId: number, on: boolean): Promise<void> {
  const id = await myId();
  const { error } = on
    ? await supabase.from('high_fives').upsert({ post_id: postId, user_id: id }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
    : await supabase.from('high_fives').delete().eq('post_id', postId).eq('user_id', id);
  fail(error);
}

export interface Comment {
  id: number;
  text: string;
  createdAt: string;
  author: Profile;
}

export async function loadComments(postId: number): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, text, created_at, author:profiles!comments_user_id_fkey(id, username, display_name)')
    .eq('post_id', postId)
    .order('created_at');
  fail(error);
  return (data ?? []).map((r) => ({ id: r.id, text: r.text, createdAt: r.created_at, author: toProfile(r.author as unknown as ProfileRow) }));
}

export async function addComment(postId: number, text: string): Promise<void> {
  const id = await myId();
  fail((await supabase.from('comments').insert({ post_id: postId, user_id: id, text: text.trim() })).error);
}

export async function deleteComment(commentId: number): Promise<void> {
  fail((await supabase.from('comments').delete().eq('id', commentId)).error);
}

export async function deletePost(postId: number): Promise<void> {
  fail((await supabase.from('posts').delete().eq('id', postId)).error);
}

// Sharing. Posts wait in a queue on the phone, so a workout finished with no signal is shared later.

/** Queues a session for friends (or for your coach only, when `visibility` is 'coach'). */
export async function sharePost(db: SQLiteDatabase, post: NewPost & { visibility?: 'friends' | 'coach' }): Promise<void> {
  if (!socialConfigured) return;
  const queue = (await loadRecord<QueuedPost[]>(db, QUEUE)) ?? [];
  await saveRecord(db, QUEUE, [...queue.filter((p) => p.clientId !== post.clientId), post]);
  await flushShareQueue(db);
}

/** Uploads waiting posts. Never throws; whatever fails stays queued. */
export async function flushShareQueue(db: SQLiteDatabase): Promise<void> {
  const queue = (await loadRecord<QueuedPost[]>(db, QUEUE)) ?? [];
  if (!queue.length) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const me = data.session.user.id;
  // Coach-only sessions are uploaded only while there is a coach to see them.
  const hasCoach = queue.some((p) => p.visibility === 'coach')
    ? !!(await supabase.from('coaching').select('coach').eq('client', me).maybeSingle()).data
    : false;
  const left: QueuedPost[] = [];
  for (const p of queue) {
    if (p.visibility === 'coach' && !hasCoach) continue;
    const { error } = await supabase.from('posts').upsert(
      {
        user_id: me,
        client_id: p.clientId,
        kind: p.kind,
        title: p.title,
        body: p.body,
        happened_at: p.happenedAt,
        visibility: p.visibility ?? 'friends',
      },
      { onConflict: 'user_id,client_id', ignoreDuplicates: true },
    );
    if (error) left.push(p);
  }
  await saveRecord(db, QUEUE, left.length ? left : null);
}
