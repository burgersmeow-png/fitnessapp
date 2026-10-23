import assert from 'node:assert/strict';
import { test } from 'node:test';
import { link, restAfterSet, supersetNext, unlink, type Pair } from './superset';

const s = (id: number, exerciseId: string, done = false) => ({ id, exerciseId, completedAt: done ? 'x' : null, restSeconds: 90 });

test('a superset alternates lifts and rests after the second', () => {
  const pairs: Pair[] = [['bench', 'row']];
  const sets = [s(1, 'bench', true), s(2, 'bench'), s(3, 'row'), s(4, 'row'), s(5, 'curl')];
  assert.equal(supersetNext(sets[0], sets, pairs)?.id, 3);
  assert.equal(restAfterSet(sets[0], sets, pairs), 0);
  const afterRow = [s(1, 'bench', true), s(2, 'bench'), s(3, 'row', true), s(4, 'row'), s(5, 'curl')];
  assert.equal(restAfterSet(afterRow[2], afterRow, pairs), 90);
  assert.equal(supersetNext(afterRow[2], afterRow, pairs)?.id, 2);
  // Once the partner is finished, the first lift rests normally.
  const rowDone = [s(1, 'bench', true), s(2, 'bench'), s(3, 'row', true), s(4, 'row', true)];
  assert.equal(restAfterSet(rowDone[0], rowDone, pairs), 90);
  // Lifts outside a superset are untouched.
  assert.equal(supersetNext(sets[4], sets, pairs), null);
  assert.equal(restAfterSet(sets[4], sets, pairs), 90);
});

test('linking replaces old pairs', () => {
  let pairs = link([], 'bench', 'row');
  pairs = link(pairs, 'row', 'curl');
  assert.deepEqual(pairs, [['row', 'curl']]);
  assert.deepEqual(unlink(pairs, 'curl'), []);
});
