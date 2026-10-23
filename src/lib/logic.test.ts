import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES, EXERCISES_BY_ID } from './exercises';
import { exerciseCount, generateWorkout, muscleRecovery } from './generator';
import { estimate1RM, personalRecords, suggestWeight } from './progression';
import { DEFAULT_SETTINGS, type LoggedSet } from './types';

const now = new Date('2026-10-23T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 36e5).toISOString();

test('estimate1RM counts reps in reserve', () => {
  assert.equal(estimate1RM(100, 1, 0), 100);
  assert.equal(Math.round(estimate1RM(100, 10, 0)), 133);
  assert.equal(Math.round(estimate1RM(100, 8, 2)), 133);
});

test('suggestWeight rises after beating the target', () => {
  const easy: LoggedSet[] = [
    { exerciseId: 'bb-bench', weight: 185, reps: 8, rir: 4, completedAt: hoursAgo(72) },
  ];
  const onTarget: LoggedSet[] = [
    { exerciseId: 'bb-bench', weight: 185, reps: 8, rir: 2, completedAt: hoursAgo(72) },
  ];
  assert.equal(suggestWeight(onTarget, 'bb-bench', 8, 2), 185);
  assert.ok(suggestWeight(easy, 'bb-bench', 8, 2)! > 185);
  assert.equal(suggestWeight([], 'bb-bench', 8, 2), null);
});

test('suggestWeight only uses the most recent session', () => {
  const history: LoggedSet[] = [
    { exerciseId: 'ohp', weight: 135, reps: 5, rir: 0, completedAt: hoursAgo(24 * 30) },
    { exerciseId: 'ohp', weight: 95, reps: 5, rir: 2, completedAt: hoursAgo(48) },
  ];
  assert.equal(suggestWeight(history, 'ohp', 5, 2), 95);
});

test('muscleRecovery fades over 72 hours', () => {
  const sets: LoggedSet[] = Array.from({ length: 6 }, () => ({
    exerciseId: 'back-squat', weight: 225, reps: 5, rir: 2, completedAt: hoursAgo(1),
  }));
  const fresh = muscleRecovery(sets, EXERCISES_BY_ID, now);
  assert.ok(fresh.quads < 0.6);
  assert.equal(fresh.chest, 1);
  const later = muscleRecovery(sets, EXERCISES_BY_ID, new Date(now.getTime() + 72 * 36e5));
  assert.equal(later.quads, 1);
});

test('generateWorkout avoids fatigued muscles and respects equipment', () => {
  const legDay: LoggedSet[] = [];
  for (const id of ['back-squat', 'leg-press', 'rdl', 'leg-extension']) {
    for (let i = 0; i < 4; i++) {
      legDay.push({ exerciseId: id, weight: 200, reps: 8, rir: 1, completedAt: hoursAgo(20) });
    }
  }
  const settings = { ...DEFAULT_SETTINGS, equipment: ['dumbbell', 'bodyweight'] as const };
  const workout = generateWorkout(EXERCISES, legDay, { ...settings, equipment: [...settings.equipment] }, now);
  assert.equal(workout.exercises.length, exerciseCount(DEFAULT_SETTINGS.minutes));
  for (const p of workout.exercises) {
    const e = EXERCISES_BY_ID.get(p.exerciseId)!;
    assert.ok(['dumbbell', 'bodyweight'].includes(e.equipment), e.name);
  }
  assert.ok(!workout.focus.includes('quads'));
  assert.ok(!workout.focus.includes('hamstrings'));
});

test('generateWorkout puts compound lifts first and has no duplicates', () => {
  const workout = generateWorkout(EXERCISES, [], DEFAULT_SETTINGS, now);
  const ids = workout.exercises.map((p) => p.exerciseId);
  assert.equal(new Set(ids).size, ids.length);
  const compound = ids.map((id) => EXERCISES_BY_ID.get(id)!.compound);
  assert.deepEqual(compound, [...compound].sort((a, b) => Number(b) - Number(a)));
});

test('personalRecords keeps the best estimated 1RM', () => {
  const prs = personalRecords([
    { exerciseId: 'deadlift', weight: 315, reps: 5, rir: 0, completedAt: hoursAgo(100) },
    { exerciseId: 'deadlift', weight: 365, reps: 1, rir: 0, completedAt: hoursAgo(50) },
  ]);
  assert.equal(prs.get('deadlift')!.weight, 315);
});
