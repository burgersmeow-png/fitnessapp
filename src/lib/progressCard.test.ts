import assert from 'node:assert/strict';
import { test } from 'node:test';
import { progressCardContent, progressSummary } from './progressCard';
import type { LoggedSet } from './types';

const set = (exerciseId: string, weight: number, reps: number, at: string): LoggedSet => ({ exerciseId, weight, reps, rir: null, completedAt: at });
const now = new Date('2026-10-23T12:00:00Z');
const history = [
  set('squat', 135, 5, '2026-09-01T08:00:00Z'),
  set('squat', 125, 8, '2026-09-01T08:10:00Z'),
  set('squat', 185, 5, '2026-10-20T08:00:00Z'),
  set('bench', 135, 5, '2026-09-01T08:20:00Z'),
  set('bench', 145, 5, '2026-10-20T08:20:00Z'),
  set('curl', 30, 10, '2026-10-20T08:30:00Z'),
];
const dates = ['2026-10-20T08:00:00Z', '2026-09-01T08:00:00Z'];

test('gains compare the first day of each lift with its best', () => {
  const p = progressSummary(history, dates, now)!;
  assert.equal(p.since, '2026-09-01T08:00:00Z');
  assert.equal(p.weeks, 8);
  assert.equal(p.workouts, 2);
  assert.deepEqual(p.gains, [
    { exerciseId: 'squat', from: 135, to: 185 },
    { exerciseId: 'bench', from: 135, to: 145 },
  ]);
});

test('no card until there are two workouts', () => {
  assert.equal(progressSummary(history, dates.slice(0, 1), now), null);
});

test('the card lists gains as from → to', () => {
  const c = progressCardContent(progressSummary(history, dates, now)!, (id) => id.toUpperCase(), 'lb', 'en-US');
  assert.equal(c.eyebrow, 'MY PROGRESS · SINCE SEP 1, 2026');
  assert.equal(c.headline, '8 WEEKS STRONGER');
  assert.deepEqual(c.lines[0], { name: 'SQUAT', detail: '135 → 185 lb (+50)', pr: true });
  const flat = progressCardContent({ since: dates[1], weeks: 2, workouts: 3, volume: 900, gains: [] }, String, 'kg', 'en-US');
  assert.equal(flat.headline, '3 WORKOUTS IN');
});
