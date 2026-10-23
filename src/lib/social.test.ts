import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkUsername, initials, startOfWeek, timeAgo, weeklyLeaderboard, type FeedPost, type Profile } from './social';

const ann: Profile = { id: 'a', username: 'ann', displayName: 'Ann' };
const bob: Profile = { id: 'b', username: 'bob', displayName: 'Bob' };
const cat: Profile = { id: 'c', username: 'cat', displayName: 'Cat' };
const now = new Date(2026, 9, 23, 12); // Friday

const post = (author: Profile, daysAgo: number, minutes: number, volumeKg?: number): FeedPost => ({
  id: Math.random(),
  clientId: 'x',
  kind: volumeKg == null ? 'cardio' : 'workout',
  title: 't',
  body: volumeKg == null ? { cardioType: 'run', minutes, distanceKm: 5 } : { minutes, sets: 10, volumeKg, prs: [], exercises: [] },
  happenedAt: new Date(now.getTime() - daysAgo * 864e5).toISOString(),
  author,
  highFives: [],
  comments: 0,
});

test('usernames are cleaned and checked', () => {
  assert.deepEqual(checkUsername(' @Sam_R '), { ok: true, username: 'sam_r' });
  assert.equal(checkUsername('ab').ok, false);
  assert.equal(checkUsername('sam rivera').ok, false);
  assert.equal(checkUsername('a'.repeat(21)).ok, false);
});

test('the week starts on Monday', () => {
  assert.equal(startOfWeek(now).toDateString(), new Date(2026, 9, 19).toDateString());
  assert.equal(startOfWeek(new Date(2026, 9, 25, 9)).toDateString(), new Date(2026, 9, 19).toDateString());
});

test('the leaderboard ranks this week by sessions, then minutes, and includes friends with none', () => {
  const rows = weeklyLeaderboard(
    [post(ann, 1, 30, 5000), post(ann, 2, 40), post(bob, 0, 90, 8000), post(bob, 6, 60, 9000), post(bob, 3, 20)],
    [ann, bob, cat],
    now,
  );
  assert.deepEqual(rows.map((r) => [r.profile.username, r.sessions, r.minutes, r.volumeKg]), [
    ['bob', 2, 110, 8000],
    ['ann', 2, 70, 5000],
    ['cat', 0, 0, 0],
  ]);
});

test('times and initials read naturally', () => {
  const t = Date.parse('2026-10-23T12:00:00Z');
  assert.equal(timeAgo('2026-10-23T11:59:40Z', t), 'now');
  assert.equal(timeAgo('2026-10-23T11:15:00Z', t), '45m');
  assert.equal(timeAgo('2026-10-23T07:00:00Z', t), '5h');
  assert.equal(timeAgo('2026-10-21T12:00:00Z', t), '2d');
  assert.equal(initials('Sam Rivera'), 'SR');
  assert.equal(initials('sam'), 'SA');
});

test('post titles name the time of day and what was trained', async () => {
  const { workoutTitle, cardioTitle } = await import('./social');
  const evening = new Date(2026, 9, 23, 18).toISOString();
  assert.equal(workoutTitle(evening, ['Chest', 'Back', 'Chest', 'Triceps']), 'Evening chest & back workout');
  assert.equal(workoutTitle(new Date(2026, 9, 23, 7).toISOString(), []), 'Morning workout');
  assert.equal(cardioTitle(evening, 'Run'), 'Evening run');
});
