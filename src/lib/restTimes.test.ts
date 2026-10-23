import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adjustRest, REST_MAX, REST_MIN, restFor } from './restTimes';

test('rest times step, clamp and fall back to the plan', () => {
  let t = adjustRest({}, 'bench', 120, 15);
  assert.deepEqual(t, { bench: 135 });
  assert.equal(restFor(t, 'bench', 120), 135);
  assert.equal(restFor(t, 'row', 90), 90);
  t = adjustRest(t, 'bench', 120, -15);
  assert.deepEqual(t, {});
  assert.equal(restFor(adjustRest({}, 'curl', 30, -60), 'curl', 30), REST_MIN);
  assert.equal(restFor(adjustRest({}, 'squat', 590, 60), 'squat', 590), REST_MAX);
});
