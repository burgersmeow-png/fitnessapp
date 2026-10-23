import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSaved, MAX_SAVED, removeSaved, saveWorkout } from './savedWorkouts';
import type { WorkoutLink } from './workoutLink';

const legs: WorkoutLink = { title: 'Legs', lifts: [{ id: 'bb-squat', name: 'Back Squat', sets: 4, reps: 5, rest: 180 }, { id: 'rdl', name: 'RDL', sets: 3, reps: 8, rest: 120 }] };
const push: WorkoutLink = { title: 'Push', lifts: [{ id: 'bb-bench', name: 'Bench', sets: 3, reps: 8, rest: 120 }] };

test('newest first, with lift and set counts', () => {
  const list = saveWorkout(saveWorkout([], legs, new Date(1)), push, new Date(2));
  assert.deepEqual(list.map((s) => [s.title, s.lifts, s.sets]), [['Push', 1, 3], ['Legs', 2, 7]]);
  assert.ok(isSaved(list, legs));
});

test('saving the same workout again moves it to the top instead of duplicating', () => {
  const list = saveWorkout(saveWorkout(saveWorkout([], legs), push), legs);
  assert.deepEqual(list.map((s) => s.title), ['Legs', 'Push']);
});

test('removing and the cap', () => {
  let list = saveWorkout([], legs);
  list = removeSaved(list, list[0].id);
  assert.equal(isSaved(list, legs), false);
  for (let i = 0; i < MAX_SAVED + 5; i++) list = saveWorkout(list, { ...push, title: `W${i}` });
  assert.equal(list.length, MAX_SAVED);
  assert.equal(list[0].title, `W${MAX_SAVED + 4}`);
});
