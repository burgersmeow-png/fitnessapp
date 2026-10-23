import type { SQLiteDatabase } from 'expo-sqlite';
import { challengeProgress, encodeChallenge, rankBoard, type JoinedChallenge } from '../lib/challenge';
import { loadChallenge } from './challenge';
import { loadSessionDates } from './habits';
import { socialConfigured, supabase } from './supabase';

async function signedInId(): Promise<string | null> {
  if (!socialConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Puts your current challenge progress online for friends to see, or removes it when you
 * left. Does nothing when signed out. Best effort: the challenge itself lives on the phone.
 */
export async function syncChallengeEntry(db: SQLiteDatabase): Promise<void> {
  const me = await signedInId();
  if (!me) return;
  const c = await loadChallenge(db);
  if (!c) {
    await supabase.from('challenge_entries').delete().eq('user_id', me);
    return;
  }
  const p = challengeProgress(c, await loadSessionDates(db), new Date());
  await supabase.from('challenge_entries').upsert({
    user_id: me,
    challenge_key: encodeChallenge(c),
    title: c.title,
    sessions: c.sessions,
    days: c.days,
    start_day: c.start,
    done: p.done,
    updated_at: new Date().toISOString(),
  });
}

export type Board = { signedIn: false } | { signedIn: true; entries: ReturnType<typeof rankBoard> };

/** You and your friends in the same challenge, ranked. */
export async function loadBoard(c: JoinedChallenge): Promise<Board> {
  const me = await signedInId();
  if (!me) return { signedIn: false };
  const { data, error } = await supabase
    .from('challenge_entries')
    .select('user_id, done, author:profiles!challenge_entries_user_id_fkey(display_name)')
    .eq('challenge_key', encodeChallenge(c));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as { user_id: string; done: number; author: { display_name: string } }[];
  return { signedIn: true, entries: rankBoard(rows.map((r) => ({ userId: r.user_id, name: r.author.display_name, done: r.done })), me) };
}
