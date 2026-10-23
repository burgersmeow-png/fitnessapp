// Checks the privacy rules against a real Supabase project or local stack.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node --test supabase/tests/rls.test.mjs
// It signs up throwaway users, so point it at a test project, never at production.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
const run = Math.random().toString(36).slice(2, 8);

async function user(name) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signUp({ email: `${name}-${run}@example.com`, password: 'test-password-123' });
  assert.ifError(error);
  const id = data.user.id;
  const p = await c.from('profiles').insert({ id, username: `${name}_${run}`, display_name: name });
  assert.ifError(p.error);
  return { c, id };
}

const post = (c, clientId) =>
  c.from('posts').insert({ client_id: clientId, kind: 'workout', title: 'Leg day', body: { sets: 12 }, happened_at: new Date().toISOString() }).select().single();

test('privacy rules', { skip: !SUPABASE_URL && 'set SUPABASE_URL and SUPABASE_ANON_KEY' }, async () => {
  const ann = await user('ann');
  const bob = await user('bob');
  const eve = await user('eve');

  const { data: p, error } = await post(ann.c, 'w1');
  assert.ifError(error);
  // The same workout uploaded twice is refused, so retries can't double post.
  assert.equal((await post(ann.c, 'w1')).error?.code, '23505');

  // Not friends yet: Bob can't see Ann's post.
  assert.equal((await bob.c.from('posts').select().eq('id', p.id)).data.length, 0);

  // Bob asks, and can't accept his own request.
  assert.ifError((await bob.c.from('friendships').insert({ requester: bob.id, addressee: ann.id })).error);
  await bob.c.from('friendships').update({ status: 'accepted' }).eq('requester', bob.id).eq('addressee', ann.id);
  assert.equal((await bob.c.from('posts').select().eq('id', p.id)).data.length, 0);
  // No duplicate request the other way round.
  assert.ok((await ann.c.from('friendships').insert({ requester: ann.id, addressee: bob.id })).error);

  // Ann accepts: now Bob sees it, high-fives and comments.
  assert.ifError((await ann.c.from('friendships').update({ status: 'accepted' }).eq('requester', bob.id).eq('addressee', ann.id)).error);
  assert.equal((await bob.c.from('posts').select().eq('id', p.id)).data.length, 1);
  assert.ifError((await bob.c.from('high_fives').insert({ post_id: p.id })).error);
  assert.ifError((await bob.c.from('comments').insert({ post_id: p.id, text: 'Strong!' })).error);

  // Eve, a stranger, sees nothing and can't interact or impersonate.
  assert.equal((await eve.c.from('posts').select()).data.filter((x) => x.user_id === ann.id).length, 0);
  assert.equal((await eve.c.from('comments').select().eq('post_id', p.id)).data.length, 0);
  assert.ok((await eve.c.from('high_fives').insert({ post_id: p.id })).error);
  assert.ok((await eve.c.from('comments').insert({ post_id: p.id, text: 'hi' })).error);
  assert.ok((await eve.c.from('posts').insert({ user_id: ann.id, client_id: 'x', kind: 'workout', title: 'fake', body: {}, happened_at: new Date().toISOString() })).error);
  assert.equal((await eve.c.from('friendships').select()).data.length, 0);
  await eve.c.from('profiles').update({ display_name: 'hacked' }).eq('id', ann.id);
  assert.equal((await ann.c.from('profiles').select('display_name').eq('id', ann.id).single()).data.display_name, 'ann');
  // Eve can't approve a friendship by posting an accepted one.
  assert.ok((await eve.c.from('friendships').insert({ requester: eve.id, addressee: ann.id, status: 'accepted' })).error);

  // Feed query used by the app: profile, high-fives and comment count embedded.
  const feed = await bob.c.from('posts').select('id, author:profiles!posts_user_id_fkey(username, display_name), high_fives(user_id), comments(count)').eq('id', p.id).single();
  assert.ifError(feed.error);
  assert.equal(feed.data.high_fives.length, 1);
  assert.equal(feed.data.comments[0].count, 1);

  // Signed out, nothing is readable.
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await anon.from('posts').select()).error || (await anon.from('posts').select()).data.length === 0);
  assert.ok((await anon.from('profiles').select()).error || (await anon.from('profiles').select()).data.length === 0);

  // Deleting an account removes everything that person made.
  assert.ifError((await ann.c.rpc('delete_account')).error);
  assert.equal((await bob.c.from('posts').select().eq('id', p.id)).data.length, 0);
  assert.equal((await bob.c.from('friendships').select()).data.length, 0);
  await bob.c.rpc('delete_account');
  await eve.c.rpc('delete_account');
});
