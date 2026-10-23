import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeHow, BADGES, bestStreak, countPrs, earnedBadges, goalLine, reminderTimes, weekProgress, type HabitStats } from './habits';

const now = new Date(2026, 9, 23, 12); // Friday
const at = (daysAgo: number, hour = 9) => new Date(2026, 9, 23 - daysAgo, hour).toISOString();

test('the goal counts training days this week, not sessions', () => {
  // Monday twice (lift and cardio), Wednesday, and last Sunday which is the week before.
  const p = weekProgress([at(4, 8), at(4, 18), at(2), at(5)], 3, now);
  assert.equal(p.done, 2);
  assert.equal(p.daysLeft, 3);
  assert.equal(goalLine(p), '1 more session to hit your goal.');
});

test('the streak counts goal weeks and this week only joins once hit', () => {
  // Two earlier weeks with 2 days each, this week with 1 so far.
  const dates = [at(7), at(9), at(14), at(16), at(1)];
  assert.equal(weekProgress(dates, 2, now).streak, 2);
  assert.equal(weekProgress([...dates, at(0)], 2, now).streak, 3);
  // A missed week breaks it.
  assert.equal(weekProgress([at(14), at(16), at(1)], 2, now).streak, 0);
  assert.equal(bestStreak([at(14), at(16), at(28), at(29), at(35), at(36)], 2), 2);
});

test('the goal line stays encouraging when the week is nearly over', () => {
  assert.match(goalLine({ done: 0, goal: 5, streak: 0, daysLeft: 2 }), /2 days left/);
  assert.match(goalLine({ done: 4, goal: 3, streak: 1, daysLeft: 2 }), /smashed/);
});

test('PRs need a baseline and count once per lift per day', () => {
  const set = (exerciseId: string, weight: number, reps: number, day: number) => ({ exerciseId, weight, reps, rir: null, completedAt: at(day) });
  const sets = [set('squat', 100, 5, 10), set('squat', 105, 5, 5), set('squat', 110, 5, 5), set('squat', 100, 5, 2), set('bench', 60, 5, 2)];
  assert.equal(countPrs(sets), 1);
  assert.equal(countPrs([...sets, set('squat', 120, 3, 0)]), 2);
});

test('badges unlock from stats', () => {
  const none: HabitStats = { workouts: 0, cardio: 0, prs: 0, volumeKg: 0, foodDays: 0, bestStreak: 0 };
  assert.deepEqual(earnedBadges(none), []);
  const some = earnedBadges({ ...none, workouts: 12, foodDays: 1, volumeKg: 12_000 });
  assert.deepEqual(some, ['workouts-1', 'workouts-10', 'volumeKg-10000', 'foodDays-1']);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
  assert.equal(badgeHow(BADGES.find((b) => b.id === 'volumeKg-10000')!, 'lb'), 'Lift 22,000 lb in total.');
});

test('reminders fall on chosen days and skip when not needed', () => {
  const evening = 18 * 60;
  // Friday noon: today (Fri), then Mon and Fri next week, over the next 14 days.
  const times = reminderTimes([1, 5], evening, { trainedToday: false, goalHit: false }, now);
  assert.deepEqual(times.map((d) => d.getDate()), [23, 26, 30, 2]);
  assert.equal(times[0].getHours(), 18);
  assert.equal(reminderTimes([1, 5], evening, { trainedToday: true, goalHit: false }, now)[0].getDate(), 26);
  // Goal already hit: nothing more this week.
  assert.equal(reminderTimes([5, 6], evening, { trainedToday: false, goalHit: true }, now)[0].getDate(), 30);
  // A time already past today is skipped.
  assert.equal(reminderTimes([5], 8 * 60, { trainedToday: false, goalHit: false }, now)[0].getDate(), 30);
});
