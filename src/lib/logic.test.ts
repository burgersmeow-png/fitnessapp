import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardioFatigue } from './cardio';
import { EXERCISES, EXERCISES_BY_ID } from './exercises';
import { exerciseCount, generateWorkout, muscleRecovery } from './generator';
import { adjustNextSet, estimate1RM, liftStatus, personalRecords, suggestNext, suggestWeight, trainingMax } from './progression';
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

test('suggestWeight ignores sessions from before a long break', () => {
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

const day = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();

test('trainingMax smooths a bad day but takes a new best at once', () => {
  const steady: LoggedSet[] = [
    { exerciseId: 'bb-row', weight: 185, reps: 8, rir: 2, completedAt: day(7) },
    { exerciseId: 'bb-row', weight: 185, reps: 8, rir: 2, completedAt: day(4) },
    { exerciseId: 'bb-row', weight: 135, reps: 8, rir: 2, completedAt: day(1) },
  ];
  const max = trainingMax(steady, 'bb-row')!;
  assert.ok(max > estimate1RM(135, 8, 2) && max < estimate1RM(185, 8, 2));
  const best = [...steady.slice(0, 2), { exerciseId: 'bb-row', weight: 205, reps: 8, rir: 2, completedAt: day(1) }];
  assert.equal(trainingMax(best, 'bb-row'), estimate1RM(205, 8, 2));
});

test('liftStatus flags a stall and suggestNext deloads it', () => {
  const flat: LoggedSet[] = [10, 8, 6, 4, 2].map((d) => ({
    exerciseId: 'ohp', weight: 115, reps: 5, rir: 1, completedAt: day(d),
  }));
  assert.equal(liftStatus(flat, 'ohp'), 'stalled');
  const next = suggestNext(flat, 'ohp', 5, 1);
  assert.equal(next.deload, true);
  assert.ok(next.weight! < 115);

  const rising: LoggedSet[] = [10, 8, 6, 4, 2].map((d, i) => ({
    exerciseId: 'ohp', weight: 105 + i * 5, reps: 5, rir: 1, completedAt: day(d),
  }));
  assert.equal(liftStatus(rising, 'ohp'), 'progressing');
  assert.equal(suggestNext([], 'ohp', 5, 1).status, 'new');
});

test('adjustNextSet raises an easy set and lowers a grinder, capped at 10%', () => {
  assert.equal(adjustNextSet({ weight: 135, reps: 8, rir: 2 }, 8, 2), null);
  const easier = adjustNextSet({ weight: 135, reps: 8, rir: 5 }, 8, 2)!;
  assert.ok(easier > 135 && easier <= 150);
  const harder = adjustNextSet({ weight: 135, reps: 6, rir: 0 }, 8, 2)!;
  assert.ok(harder < 135 && harder >= 120);
});

test('a hard run tires the legs and steers the plan to upper body', () => {
  const run = cardioFatigue([{ type: 'run', startedAt: hoursAgo(12), minutes: 60, rpe: 8 }]);
  const recovery = muscleRecovery([], EXERCISES_BY_ID, now, run);
  assert.ok(recovery.quads < 0.6 && recovery.calves < 0.6);
  assert.equal(recovery.chest, 1);
  const workout = generateWorkout(EXERCISES, [], DEFAULT_SETTINGS, now, run);
  assert.ok(!workout.focus.includes('quads'));
});
