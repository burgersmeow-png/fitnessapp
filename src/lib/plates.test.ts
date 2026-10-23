import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describePlates, platesPerSide, warmupSets } from './plates';

test('plates per side, heaviest first', () => {
  assert.deepEqual(platesPerSide(100, 'kg'), { plates: [25, 15], left: 0 });
  assert.deepEqual(platesPerSide(225, 'lb'), { plates: [45, 45], left: 0 });
  assert.deepEqual(platesPerSide(137.5, 'kg'), { plates: [25, 25, 5, 2.5, 1.25], left: 0 });
  assert.deepEqual(platesPerSide(101, 'kg'), { plates: [25, 15], left: 1 });
  assert.deepEqual(platesPerSide(20, 'kg'), { plates: [], left: 0 });
  assert.deepEqual(platesPerSide(10, 'kg'), { plates: [], left: 0 });
  assert.equal(describePlates([45, 45, 10, 2.5]), '2 × 45, 10, 2.5');
});

test('warm-ups ramp up to the working weight', () => {
  assert.deepEqual(
    warmupSets(100, 'kg', 'barbell').map((s) => [s.weight, s.reps]),
    [[20, 10], [40, 5], [60, 3], [80, 2]],
  );
  assert.deepEqual(
    warmupSets(225, 'lb', 'barbell').map((s) => s.weight),
    [45, 90, 135, 180],
  );
  // Light barbell work: no step lands under the empty bar or repeats it.
  assert.deepEqual(warmupSets(40, 'kg', 'barbell').map((s) => s.weight), [20, 30]);
  assert.deepEqual(warmupSets(20, 'kg', 'barbell'), [{ weight: 20, reps: 10, label: 'Empty bar' }]);
  assert.deepEqual(warmupSets(30, 'lb', 'dumbbell').map((s) => s.weight), [15, 25]);
  assert.deepEqual(warmupSets(null, 'kg', 'barbell'), []);
  assert.deepEqual(warmupSets(50, 'kg', 'bodyweight'), []);
});
