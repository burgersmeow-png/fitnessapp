import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarCardContent, trainingCalendar } from './trainingCalendar';

// Friday Oct 23 2026, local time.
const now = new Date(2026, 9, 23, 12);
const at = (m: number, d: number, h = 7) => new Date(2026, m, d, h).toISOString();

test('one column per week, Monday first, ending with this week', () => {
  const c = trainingCalendar([], [], now, 4);
  assert.equal(c.weeks.length, 4);
  assert.equal(c.weeks[0][0].key, '2026-09-28');
  assert.equal(c.weeks[3][0].key, '2026-10-19');
  assert.deepEqual(c.weeks[3].map((d) => d.future), [false, false, false, false, false, true, true]);
});

test('lifting beats cardio on the same day, and days are counted once', () => {
  const c = trainingCalendar([at(9, 19), at(9, 19, 18), at(9, 21)], [at(9, 19), at(9, 20), at(8, 1)], now, 4);
  assert.deepEqual(c.weeks[3].slice(0, 4).map((d) => d.level), [2, 1, 2, 0]);
  assert.equal(c.daysTrained, 3);
  assert.equal(c.sessions, 5);
  assert.equal(c.bestWeek, 3);
});

test('month labels mark where each month starts', () => {
  const c = trainingCalendar([], [], now, 8, 'en-US');
  assert.deepEqual(c.months.map((m) => m.label), ['Sep', 'Oct']);
});

test('the card counts days and marks the future', () => {
  const card = calendarCardContent(trainingCalendar([at(9, 19), at(9, 21)], [], now, 26));
  assert.equal(card.headline, '2 DAYS TRAINED');
  assert.equal(card.eyebrow, 'MY LAST 6 MONTHS');
  assert.equal(card.grid!.length, 26);
  assert.equal(card.grid![25][6], -1);
  assert.equal(card.grid![25][0], 2);
  // Both days fall in this week, so that one week is the span averaged over.
  assert.deepEqual(card.stats[2], { value: '2', label: 'DAYS / WEEK' });
});
