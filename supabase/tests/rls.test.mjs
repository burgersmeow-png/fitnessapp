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

test('coaching rules', { skip: !SUPABASE_URL && 'set SUPABASE_URL and SUPABASE_ANON_KEY' }, async () => {
  const coach = await user('coach');
  const client = await user('client');
  const eve = await user('eve');
  const today = new Date().toISOString().slice(0, 10);
  const plan = [{ exerciseId: 'barbell-back-squat', sets: 3, reps: 5, weightKg: 100 }];

  const { data: code, error } = await coach.c.rpc('coach_code');
  assert.ifError(error);
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.equal((await coach.c.rpc('coach_code')).data, code, 'the code stays the same');
  // Nobody else can read a coach's code.
  assert.equal((await eve.c.from('coach_codes').select()).data.length, 0);

  // Before joining, the coach can't assign, message or see private sessions.
  assert.ok((await coach.c.from('assignments').insert({ client: client.id, title: 'Squat', plan, scheduled_for: today })).error);
  const { data: priv } = await client.c
    .from('posts')
    .insert({ client_id: 'p1', kind: 'workout', title: 'Private', body: {}, happened_at: new Date().toISOString(), visibility: 'coach' })
    .select()
    .single();
  assert.equal((await coach.c.from('posts').select().eq('id', priv.id)).data.length, 0);

  assert.equal((await client.c.rpc('join_coach', { invite: 'NOPE00' })).error?.code, 'P0002');
  assert.equal((await coach.c.rpc('join_coach', { invite: code })).error?.code, '22023');
  assert.equal((await client.c.rpc('join_coach', { invite: ` ${code.toLowerCase()} ` })).data, coach.id);

  // Now the coach sees the client's coach-only session; friends-only strangers still don't.
  assert.equal((await coach.c.from('posts').select().eq('id', priv.id)).data.length, 1);
  assert.equal((await eve.c.from('posts').select().eq('id', priv.id)).data.length, 0);

  const { data: a, error: ae } = await coach.c.from('assignments').insert({ client: client.id, title: 'Squat day', plan, scheduled_for: today }).select().single();
  assert.ifError(ae);
  assert.equal((await client.c.from('assignments').select()).data.length, 1);
  assert.equal((await eve.c.from('assignments').select()).data.length, 0);
  // The client ticks it off but can't rewrite it.
  assert.ifError((await client.c.from('assignments').update({ completed_at: new Date().toISOString() }).eq('id', a.id)).error);
  assert.ok((await client.c.from('assignments').update({ title: 'Rest day' }).eq('id', a.id)).error);
  // Eve can't assign to someone else's client, or join as a coach of them.
  assert.ok((await eve.c.from('assignments').insert({ client: client.id, title: 'x', plan, scheduled_for: today })).error);
  assert.ok((await eve.c.from('coaching').insert({ coach: eve.id, client: client.id })).error);

  assert.ifError((await client.c.from('messages').insert({ coach: coach.id, client: client.id, text: 'Knee feels sore' })).error);
  assert.ifError((await coach.c.from('messages').insert({ coach: coach.id, client: client.id, text: 'Swap squats for leg press' })).error);
  assert.equal((await coach.c.from('messages').select()).data.length, 2);
  assert.equal((await eve.c.from('messages').select()).data.length, 0);
  assert.ok((await eve.c.from('messages').insert({ coach: coach.id, client: client.id, sender: eve.id, text: 'hi' })).error);
  assert.ok((await client.c.from('messages').insert({ coach: coach.id, client: client.id, sender: coach.id, text: 'fake' })).error);

  // A client has one coach at a time.
  const other = await user('coach2');
  const code2 = (await other.c.rpc('coach_code')).data;
  assert.equal((await client.c.rpc('join_coach', { invite: code2 })).error?.code, '23505');

  // Leaving ends access both ways.
  assert.ifError((await client.c.from('coaching').delete().eq('client', client.id)).error);
  assert.equal((await coach.c.from('posts').select().eq('id', priv.id)).data.length, 0);
  assert.equal((await coach.c.from('messages').select()).data.length, 0);
  assert.equal((await client.c.from('assignments').select()).data.length, 0);

  for (const u of [coach, client, eve, other]) await u.c.rpc('delete_account');
});

test('payment rules', { skip: !SUPABASE_URL && 'set SUPABASE_URL and SUPABASE_ANON_KEY' }, async () => {
  const coach = await user('paycoach');
  const client = await user('payclient');
  const eve = await user('payeve');
  const code = (await coach.c.rpc('coach_code')).data;
  assert.ifError((await client.c.rpc('join_coach', { invite: code })).error);

  // A coach sets their own price, but can't connect a payout account or switch on payments themselves.
  assert.ifError((await coach.c.from('coach_payouts').insert({ coach: coach.id, price_cents: 4000 })).error);
  assert.ifError((await coach.c.from('coach_payouts').upsert({ coach: coach.id, price_cents: 4500 })).error);
  assert.ifError((await coach.c.from('coach_payouts').update({ price_cents: 5000 }).eq('coach', coach.id)).error);
  assert.ok((await coach.c.from('coach_payouts').update({ charges_enabled: true }).eq('coach', coach.id)).error);
  assert.ok((await coach.c.from('coach_payouts').update({ stripe_account: 'acct_fake' }).eq('coach', coach.id)).error);
  assert.ok((await eve.c.from('coach_payouts').insert({ coach: coach.id, price_cents: 1 })).error);
  assert.equal((await eve.c.from('coach_payouts').select()).data.length, 0);

  // The client sees the offer; others see nothing.
  assert.deepEqual((await client.c.rpc('my_coach_offer')).data, [{ price_cents: 5000, currency: 'usd', ready: false }]);
  assert.deepEqual((await eve.c.rpc('my_coach_offer')).data, []);

  // Nobody marks themselves as paid.
  await client.c.from('coaching').update({ paid_status: 'active' }).eq('client', client.id);
  await coach.c.from('coaching').update({ paid_status: 'active' }).eq('client', client.id);
  assert.equal((await client.c.from('coaching').select('paid_status').single()).data.paid_status, 'none');

  for (const u of [coach, client, eve]) await u.c.rpc('delete_account');
});

test('push token rules', { skip: !SUPABASE_URL && 'set SUPABASE_URL and SUPABASE_ANON_KEY' }, async () => {
  const ann = await user('pushann');
  const bob = await user('pushbob');
  const token = `ExponentPushToken[${run}-phone]`;
  assert.ifError((await ann.c.rpc('claim_push_token', { t: token })).error);
  assert.equal((await ann.c.from('push_tokens').select()).data.length, 1);
  // Nobody reads or adds tokens directly.
  assert.equal((await bob.c.from('push_tokens').select()).data.length, 0);
  assert.ok((await bob.c.from('push_tokens').insert({ token: `ExponentPushToken[${run}-x]`, user_id: ann.id })).error);
  assert.ok((await ann.c.rpc('claim_push_token', { t: 'not-a-token' })).error);
  // The same phone signed in as Bob now alerts Bob.
  assert.ifError((await bob.c.rpc('claim_push_token', { t: token })).error);
  assert.equal((await ann.c.from('push_tokens').select()).data.length, 0);
  assert.equal((await bob.c.from('push_tokens').select()).data.length, 1);
  await bob.c.from('push_tokens').delete().eq('token', token);
  assert.equal((await bob.c.from('push_tokens').select()).data.length, 0);
  for (const u of [ann, bob]) await u.c.rpc('delete_account');
});

test('creator code rules', { skip: !SUPABASE_URL && 'set SUPABASE_URL and SUPABASE_ANON_KEY' }, async () => {
  // Codes, referrals and stats are for the helper server only: no app user can list, add or count them.
  const ann = await user('refann');
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  for (const c of [ann.c, anon]) {
    assert.ok((await c.from('creator_codes').select()).error);
    assert.ok((await c.from('referrals').select()).error);
    assert.ok((await c.from('creator_stats').select()).error);
    assert.ok((await c.from('creator_codes').insert({ code: `X${run}`.toUpperCase(), creator_name: 'Me' })).error);
    assert.ok((await c.from('referrals').insert({ install_id: `${run}-0000-0000-0000`, code: 'ALEX10' })).error);
    assert.ok((await c.from('creator_link_opens').select()).error);
    assert.ok((await c.rpc('count_link_open', { p_code: 'ALEX10' })).error);
  }
  await ann.c.rpc('delete_account');
});

test('challenge leaderboard rules', { skip: !SUPABASE_URL && 'set SUPABASE_URL and SUPABASE_ANON_KEY' }, async () => {
  const ann = await user('cann');
  const bob = await user('cbob');
  const eve = await user('ceve');
  const entry = { challenge_key: 'WzEsIjEyIGluIDQgd2Vla3MiLDEyLDI4XQ', title: '12 in 4 weeks', sessions: 12, days: 28, start_day: '2026-10-01', done: 3 };

  assert.ifError((await ann.c.from('challenge_entries').upsert(entry)).error);
  // Progress can't go past the goal, and nobody can write someone else's row.
  assert.ok((await ann.c.from('challenge_entries').upsert({ ...entry, done: 13 })).error);
  assert.ok((await eve.c.from('challenge_entries').insert({ ...entry, user_id: ann.id })).error);
  await eve.c.from('challenge_entries').update({ done: 0 }).eq('user_id', ann.id);
  assert.equal((await ann.c.from('challenge_entries').select('done').eq('user_id', ann.id).single()).data.done, 3);

  // Only accepted friends see it.
  assert.equal((await bob.c.from('challenge_entries').select().eq('user_id', ann.id)).data.length, 0);
  assert.ifError((await bob.c.from('friendships').insert({ requester: bob.id, addressee: ann.id })).error);
  assert.equal((await bob.c.from('challenge_entries').select().eq('user_id', ann.id)).data.length, 0);
  assert.ifError((await ann.c.from('friendships').update({ status: 'accepted' }).eq('requester', bob.id).eq('addressee', ann.id)).error);
  const board = await bob.c
    .from('challenge_entries')
    .select('done, author:profiles!challenge_entries_user_id_fkey(display_name)')
    .eq('challenge_key', entry.challenge_key);
  assert.ifError(board.error);
  assert.deepEqual(board.data, [{ done: 3, author: { display_name: 'cann' } }]);
  assert.equal((await eve.c.from('challenge_entries').select()).data.length, 0);

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  assert.ok((await anon.from('challenge_entries').select()).error || (await anon.from('challenge_entries').select()).data.length === 0);

  // Leaving deletes the row; deleting the account removes it too.
  assert.ifError((await ann.c.from('challenge_entries').delete().eq('user_id', ann.id)).error);
  assert.equal((await bob.c.from('challenge_entries').select().eq('user_id', ann.id)).data.length, 0);
  for (const u of [ann, bob, eve]) await u.c.rpc('delete_account');
});
