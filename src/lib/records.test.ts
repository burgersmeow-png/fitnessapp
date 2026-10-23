import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimate1RM } from './progression';
import { liftRecords, prHistory } from './records';
import type { LoggedSet } from './types';

const set = (exerciseId: string, day: number, weight: number, reps: number, hour = 10): LoggedSet => ({
  exerciseId, weight, reps, rir: 0, completedAt: new Date(2026, 9, day, hour).toISOString(),
});

test('records per lift', () => {
  const h = [set('bench', 1, 100, 5), set('bench', 3, 90, 10), set('bench', 3, 105, 1), set('push-up', 2, 0, 25), set('push-up', 4, 0, 30)];
  const [bench, push] = liftRecords(h);
  assert.equal(bench.exerciseId, 'bench');
  assert.equal(bench.best!.weight, 90); // 90 × 10 estimates higher than 100 × 5 or 105 × 1
  assert.deepEqual(bench.heaviest, { weight: 105, reps: 1, at: h[2].completedAt });
  assert.equal(bench.mostReps.reps, 10);
  assert.equal(bench.sets, 3);
  assert.equal(push.best, null);
  assert.equal(push.mostReps.reps, 30);
});

test('PR history skips the first session and counts one PR per lift per day', () => {
  const h = [
    set('bench', 1, 100, 5),
    set('bench', 1, 102.5, 5, 11), // same first day: still the baseline
    set('bench', 3, 105, 5),
    set('bench', 3, 107.5, 5, 11),
    set('bench', 5, 100, 5), // not a PR
  ];
  const prs = prHistory(h);
  assert.equal(prs.length, 1);
  assert.equal(prs[0].weight, 107.5);
  const gain = estimate1RM(107.5, 5, 0) - estimate1RM(102.5, 5, 0);
  assert.ok(Math.abs(prs[0].gain - gain) < 1e-9);
});
