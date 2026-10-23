import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES } from './exercises';
import { swapOptions } from './swap';
import type { Equipment } from './types';

const byId = new Map(EXERCISES.map((e) => [e.id, e]));
const GYM: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight', 'bands'];

test('swaps keep the main muscle and put the closest lifts first', () => {
  const bench = swapOptions(byId.get('bb-bench')!, EXERCISES, GYM);
  assert.ok(bench.length > 3);
  assert.ok(bench.every((o) => o.exercise.primary.includes('chest')));
  // Pressing movements beat flyes for a bench press.
  const ids = bench.map((o) => o.exercise.id);
  assert.ok(ids.indexOf('db-bench') < ids.indexOf('db-fly'));
  assert.equal(bench[0].match, 'same');
  assert.equal(bench.find((o) => o.exercise.id === 'db-fly')?.match, 'close');
});

test('swaps respect equipment and skip lifts already in the workout', () => {
  const home = swapOptions(byId.get('bb-bench')!, EXERCISES, ['dumbbell', 'bodyweight'], ['db-bench']);
  assert.ok(home.every((o) => ['dumbbell', 'bodyweight'].includes(o.exercise.equipment)));
  assert.ok(!home.some((o) => o.exercise.id === 'db-bench' || o.exercise.id === 'bb-bench'));
  assert.ok(swapOptions(byId.get('bb-bench')!, EXERCISES, GYM, [], 3).length === 3);
});
