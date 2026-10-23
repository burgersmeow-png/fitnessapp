import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NOTE_MAX, setNote } from './notes';

test('notes are tidied, capped and cleared when blank', () => {
  let n = setNote({}, 'bb-bench', '  seat  on 4\n close grip ');
  assert.deepEqual(n, { 'bb-bench': 'seat on 4 close grip' });
  n = setNote(n, 'ohp', 'x'.repeat(500));
  assert.equal(n.ohp.length, NOTE_MAX);
  n = setNote(n, 'bb-bench', '   ');
  assert.deepEqual(Object.keys(n), ['ohp']);
});
