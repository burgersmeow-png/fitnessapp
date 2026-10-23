import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, exportFileName, trainingCsv } from './exportCsv';

test('cells are quoted only when they need it', () => {
  assert.equal(csvCell('Bench'), 'Bench');
  assert.equal(csvCell('Press, close grip'), '"Press, close grip"');
  assert.equal(csvCell('the "good" one'), '"the ""good"" one"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(102.5), '102.5');
});

test('the training log has a header and one line per set', () => {
  const at = new Date(2026, 9, 23, 7, 5).toISOString();
  const csv = trainingCsv([{ date: at, exercise: 'Barbell Bench Press', set: 1, weight: 185, reps: 8, rir: null }], 'lb');
  assert.equal(csv, 'Date,Time,Exercise,Set,Weight (lb),Reps,Reps in reserve\r\n2026-10-23,07:05,Barbell Bench Press,1,185,8,\r\n');
  assert.equal(exportFileName(new Date('2026-10-23T12:00:00Z')), 'liftlab-training-2026-10-23.csv');
});
