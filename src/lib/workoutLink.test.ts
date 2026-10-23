import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES } from './exercises';
import {
  decodeWorkoutLink,
  encodeWorkoutLink,
  fromBase64Url,
  linkFromSets,
  planFromLink,
  toBase64Url,
  workoutFromUrl,
  workoutUrl,
  type WorkoutLink,
} from './workoutLink';

const push: WorkoutLink = {
  title: 'Push day 💪',
  lifts: [
    { id: 'bb-bench', name: 'Barbell Bench Press', sets: 4, reps: 6, rest: 150 },
    { id: 'custom-cable-fly', name: 'Cable Fly', sets: 3, reps: 12, rest: 60 },
  ],
};

test('base64url round-trips unicode and matches the standard alphabet', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'Push day 💪', 'Día de pierna']) assert.equal(fromBase64Url(toBase64Url(s)), s);
  assert.equal(toBase64Url('hello?'), Buffer.from('hello?').toString('base64url'));
  assert.equal(fromBase64Url('a'), null);
  assert.equal(fromBase64Url('ab+c'), null);
});

test('a link round-trips', () => {
  assert.deepEqual(decodeWorkoutLink(encodeWorkoutLink(push)), push);
});

test('links are found in web and app URLs', () => {
  const url = workoutUrl('https://example.github.io/liftlab', push);
  assert.match(url, /^https:\/\/example\.github\.io\/liftlab\/\?w=[A-Za-z0-9_-]+$/);
  assert.deepEqual(workoutFromUrl(url), push);
  assert.deepEqual(workoutFromUrl(`liftlab://try?code=ALEX10&w=${encodeWorkoutLink(push)}`), push);
  assert.equal(workoutFromUrl('https://example.com/?code=ALEX10'), null);
});

test('bad or hostile links are refused or clamped', () => {
  assert.equal(decodeWorkoutLink('not base64!'), null);
  assert.equal(decodeWorkoutLink(toBase64Url('{"x":1}')), null);
  assert.equal(decodeWorkoutLink(toBase64Url(JSON.stringify([2, 't', [['bb-bench', 'B', 3, 8, 90]]]))), null);
  assert.equal(decodeWorkoutLink(toBase64Url(JSON.stringify([1, 't', [['BAD ID', 'B', 3, 8, 90]]]))), null);
  assert.equal(decodeWorkoutLink(toBase64Url(JSON.stringify([1, 't', []]))), null);
  const big = decodeWorkoutLink(toBase64Url(JSON.stringify([1, 'x'.repeat(99), [['bb-bench', 'B', 99, 0, 9999]]])))!;
  assert.equal(big.title.length, 40);
  assert.deepEqual(big.lifts[0], { id: 'bb-bench', name: 'B', sets: 10, reps: 1, rest: 600 });
});

test('a finished workout becomes one line per lift', () => {
  const sets = [
    { exerciseId: 'bb-bench', targetReps: 6, reps: 6, restSeconds: 150 },
    { exerciseId: 'bb-bench', targetReps: 6, reps: 5, restSeconds: 150 },
    { exerciseId: 'pull-up', targetReps: null, reps: 10, restSeconds: 90 },
  ];
  assert.deepEqual(linkFromSets('Mine', sets, (id) => id.toUpperCase()).lifts, [
    { id: 'bb-bench', name: 'BB-BENCH', sets: 2, reps: 6, rest: 150 },
    { id: 'pull-up', name: 'PULL-UP', sets: 1, reps: 10, rest: 90 },
  ]);
});

test('lifts match by id, then by name, and the rest are listed as missing', () => {
  const library = [...EXERCISES, { ...EXERCISES[0], id: 'custom-cable-fly-2', name: 'cable fly', custom: true }];
  const { plan, missing } = planFromLink({ ...push, lifts: [...push.lifts, { id: 'custom-zercher', name: 'Zercher Squat', sets: 3, reps: 5, rest: 120 }] }, library, [], 5);
  assert.deepEqual(plan.map((p) => [p.exerciseId, p.sets, p.targetReps, p.restSeconds]), [
    ['bb-bench', 4, 6, 150],
    ['custom-cable-fly-2', 3, 12, 60],
  ]);
  assert.equal(plan[0].suggestedWeight, null);
  assert.deepEqual(missing, ['Zercher Squat']);
});
