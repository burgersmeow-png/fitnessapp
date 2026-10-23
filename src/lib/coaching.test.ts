import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayLabel, localDate, nextAssignment, planToWorkout, sortClients, summarizeClient, type Assignment } from './coaching';
import type { FeedPost, Profile } from './social';

const now = new Date(2026, 9, 23, 12); // Friday
const ann: Profile = { id: 'a', username: 'ann', displayName: 'Ann' };
const bob: Profile = { id: 'b', username: 'bob', displayName: 'Bob' };
const ago = (days: number) => new Date(now.getTime() - days * 864e5);
const post = (author: Profile, days: number) =>
  ({ id: days, author, happenedAt: ago(days).toISOString(), body: { minutes: 40 } }) as unknown as FeedPost;
const assignment = (days: number, done: boolean, client = 'a'): Assignment => ({
  id: days, coach: 'c', client, title: 't', note: '', plan: [], scheduledFor: localDate(ago(days)), completedAt: done ? ago(days).toISOString() : null,
});

test('client summary counts this week and plan completion', () => {
  const s = summarizeClient(ann, [post(ann, 1), post(ann, 3), post(ann, 9), post(bob, 0)], [assignment(1, true), assignment(3, false), assignment(20, false), assignment(-1, false)], now);
  assert.equal(s.sessionsThisWeek, 2);
  assert.equal(s.lastSessionAt, ago(1).toISOString());
  assert.deepEqual([s.due, s.done], [2, 1]);
  assert.equal(s.needsNudge, true, 'a missed assignment needs a nudge');
  // Today's plan counts once it's done, but isn't missed before then.
  assert.deepEqual([summarizeClient(ann, [], [assignment(0, true)], now).due, summarizeClient(ann, [], [assignment(0, false)], now).due], [1, 0]);
});

test('a quiet client needs a nudge and sorts first', () => {
  const quiet = summarizeClient(bob, [post(bob, 6)], [], now);
  const busy = summarizeClient(ann, [post(ann, 0)], [assignment(1, true)], now);
  assert.equal(quiet.needsNudge, true);
  assert.equal(busy.needsNudge, false);
  assert.deepEqual(sortClients([busy, quiet]).map((r) => r.client.id), ['b', 'a']);
  assert.equal(summarizeClient(bob, [], [], now).needsNudge, true);
});

test('the next assignment is the oldest one due and not done', () => {
  assert.equal(nextAssignment([assignment(0, false), assignment(2, false), assignment(-1, false), assignment(3, true)], now)!.id, 2);
  assert.equal(nextAssignment([assignment(-2, false)], now), null);
});

test('a coach plan becomes a workout in the client units', () => {
  const [w] = planToWorkout([{ exerciseId: 'x', sets: 4, reps: 5, weightKg: 100 }], (kg) => Math.round(kg * 2.2046));
  assert.deepEqual([w.sets, w.targetReps, w.suggestedWeight, w.restSeconds], [4, 5, 220, 150]);
  assert.equal(planToWorkout([{ exerciseId: 'x', sets: 3, reps: 15, weightKg: null }], (k) => k)[0].suggestedWeight, null);
});

test('day labels', () => {
  assert.equal(dayLabel(localDate(now), now), 'Today');
  assert.equal(dayLabel(localDate(ago(-1)), now), 'Tomorrow');
  assert.equal(dayLabel(localDate(ago(1)), now), 'Yesterday');
});
