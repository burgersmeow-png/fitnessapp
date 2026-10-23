import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupSets, repeatPlan, type PastSet } from './repeat';
import type { LoggedSet } from './types';

const set = (exerciseId: string, weight: number | null, reps = 8): PastSet => ({
  exerciseId, weight, reps, rir: 2, targetReps: 8, targetRir: 2, restSeconds: 120,
});

test('sets group by lift in order', () => {
  const g = groupSets([set('a', 100), set('a', 100), set('b', 50), set('a', 90)]);
  assert.deepEqual(g.map((x) => [x.exerciseId, x.sets.length]), [['a', 2], ['b', 1], ['a', 1]]);
});

test('repeating a workout keeps its shape and moves the weights on', () => {
  const day = '2026-10-20T10:00:00Z';
  const history: LoggedSet[] = [0, 1, 2].map(() => ({ exerciseId: 'a', weight: 100, reps: 10, rir: 2, completedAt: day }));
  const plan = repeatPlan([set('a', 100), set('a', 100), set('b', null, 12), set('a', 100)], history, 5);
  assert.deepEqual(plan.map((p) => [p.exerciseId, p.sets]), [['a', 3], ['b', 1]]);
  // Beat the 8-rep target with 10 reps, so the suggestion goes up.
  assert.ok(plan[0].suggestedWeight! > 100);
  assert.equal(plan[1].suggestedWeight, null);
  assert.equal(plan[0].restSeconds, 120);
});

test('a lift with no history keeps its old weight', () => {
  const plan = repeatPlan([set('c', 60)], [], 5);
  assert.equal(plan[0].suggestedWeight, 60);
});
