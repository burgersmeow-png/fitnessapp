import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beatCardContent, beatLine, beatResult, convertVolume } from './beat';
import { decodeWorkoutLink, encodeWorkoutLink, type WorkoutLink } from './workoutLink';

const legs: WorkoutLink = { title: 'Leg day', lifts: [{ id: 'back-squat', name: 'Back squat', sets: 3, reps: 5, rest: 180 }] };

test('a volume to beat rides in the link, and old links still decode', () => {
  const dare = { ...legs, beat: { volume: 12400, units: 'lb' as const } };
  assert.deepEqual(decodeWorkoutLink(encodeWorkoutLink(dare)), dare);
  assert.deepEqual(decodeWorkoutLink(encodeWorkoutLink(legs)), legs);
  assert.equal('beat' in decodeWorkoutLink(encodeWorkoutLink(legs))!, false);
});

test('a bad volume is dropped, the workout still loads', () => {
  const raw = (beat: unknown) => Buffer.from(JSON.stringify([1, 'Leg day', [['back-squat', 'Back squat', 3, 5, 180]], beat])).toString('base64url');
  assert.deepEqual(decodeWorkoutLink(raw([12400, 'stone'])), legs);
  assert.deepEqual(decodeWorkoutLink(raw(['lots', 'lb'])), legs);
  assert.deepEqual(decodeWorkoutLink(raw([1e12, 'kg']))?.beat, { volume: 10_000_000, units: 'kg' });
});

test('targets are compared in the lifter’s own units', () => {
  assert.equal(convertVolume(1000, 'kg', 'lb'), 2205);
  assert.equal(convertVolume(2205, 'lb', 'kg'), 1000);
  const r = beatResult({ volume: 5000, units: 'kg' }, 11500, 'lb');
  assert.deepEqual(r, { target: 11023, mine: 11500, beaten: true, gap: 477, percent: 104 });
  assert.equal(beatResult({ volume: 12400, units: 'lb' }, 12400, 'lb').beaten, false);
});

test('the summary line reads right for a win, a tie and a miss', () => {
  assert.equal(beatLine(beatResult({ volume: 12400, units: 'lb' }, 13100, 'lb'), 'lb', 'Alex'), '13,100 vs 12,400 lb. You topped Alex’s total by 700 lb.');
  assert.equal(beatLine(beatResult({ volume: 12400, units: 'lb' }, 12400, 'lb'), 'lb', null), '12,400 lb. A dead tie.');
  assert.equal(beatLine(beatResult({ volume: 12400, units: 'lb' }, 9300, 'lb'), 'lb', null), '9,300 of 12,400 lb (75%). 3,100 lb to go next time.');
});

test('the story card names who was beaten', () => {
  const c = beatCardContent('Leg day', beatResult({ volume: 12400, units: 'lb' }, 13100, 'lb'), 'lb', 'Alex');
  assert.equal(c.eyebrow, 'BEAT ALEX’S WORKOUT');
  assert.deepEqual(c.stats.map((s) => s.value), ['13.1K', '12.4K', '+700']);
});
