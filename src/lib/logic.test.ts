import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardioFatigue } from './cardio';
import { EXERCISES, EXERCISES_BY_ID } from './exercises';
import { EXERCISE_GUIDE } from './exerciseGuide';
import { blend, joints, repProgress } from './figure';
import { exerciseCount, generateWorkout, muscleRecovery } from './generator';
import { MOTIONS } from './motions';
import { normalizeSpeech, parseCommand } from './voice';
import { dailyTargets, mealForTime, normalizeEstimate, scaleItem } from './nutrition';
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

test('every exercise has a drawn demo and coaching cues', () => {
  for (const e of EXERCISES) {
    assert.ok(MOTIONS[e.id], `no demo for ${e.id}`);
    assert.ok((EXERCISE_GUIDE[e.id] ?? []).length >= 3, `too few cues for ${e.id}`);
  }
});

test('the demo figure keeps its anchor joint still through the rep', () => {
  for (const [id, motion] of Object.entries(MOTIONS)) {
    for (const t of [0, 0.3, 0.55, 0.8]) {
      const pose = blend(motion.from, motion.to, repProgress(t));
      const p = joints(motion, pose)[motion.anchor];
      assert.ok(Math.abs(p.x - motion.at.x) < 1e-6 && Math.abs(p.y - motion.at.y) < 1e-6, `${id} drifted at ${t}`);
    }
  }
});

test('daily targets follow body weight and goal', () => {
  const maintain = dailyTargets(80, 'maintain', 'hypertrophy');
  assert.equal(maintain.calories, 2650);
  assert.equal(maintain.protein, 160);
  assert.equal(maintain.fat, 64);
  assert.equal(maintain.carbs, Math.round((2650 - 160 * 4 - 64 * 9) / 4));
  assert.ok(dailyTargets(80, 'lose', 'hypertrophy').calories < maintain.calories);
  assert.ok(dailyTargets(80, 'gain', 'hypertrophy').calories > maintain.calories);
  // No body weight yet: falls back to a sensible default rather than zero.
  assert.ok(dailyTargets(null, 'maintain', 'strength').calories > 2000);
});

test('photo estimates are validated before they are trusted', () => {
  const e = normalizeEstimate({
    items: [
      { name: ' Grilled chicken ', portion: '150 g', calories: 250, protein_g: 46, carbs_g: 0, fat_g: 5 },
      // Calories that don't match the macros are recomputed from them.
      { name: 'Rice', portion: '1 cup', calories: 9999, protein_g: 4, carbs_g: 45, fat_g: 0.5 },
      { name: '', calories: 100 },
      'nonsense',
    ],
    confidence: 'certain',
  });
  assert.equal(e.items.length, 2);
  assert.equal(e.items[0].name, 'Grilled chicken');
  assert.equal(e.items[1].calories, Math.round(4 * 4 + 45 * 4 + 0.5 * 9));
  assert.equal(e.confidence, 'medium');
  assert.deepEqual(normalizeEstimate(null).items, []);
});

test('servings scale a food and meals follow the clock', () => {
  const oats = scaleItem({ name: 'Oats', portion: '50 g', calories: 190, protein: 6.5, carbs: 33, fat: 3.5 }, 1.5);
  assert.equal(oats.calories, 285);
  assert.equal(oats.protein, 9.8);
  assert.equal(mealForTime(new Date(2026, 9, 23, 8, 0)), 'breakfast');
  assert.equal(mealForTime(new Date(2026, 9, 23, 13, 0)), 'lunch');
  assert.equal(mealForTime(new Date(2026, 9, 23, 16, 0)), 'snack');
  assert.equal(mealForTime(new Date(2026, 9, 23, 19, 30)), 'dinner');
});

test('a checked estimate passes through a second check unchanged', () => {
  const once = normalizeEstimate({
    items: [{ name: 'Rice', portion: '1 cup', calories: 205, protein_g: 4.3, carbs_g: 45, fat_g: 0.4 }],
    confidence: 'high',
    note: '',
  });
  assert.deepEqual(normalizeEstimate(once), once);
});

test('spoken numbers become digits', () => {
  assert.equal(normalizeSpeech('Eight reps at one hundred and thirty five'), '8 reps at 135');
  assert.equal(normalizeSpeech('twenty-five kilos'), '25 kilos');
  assert.equal(normalizeSpeech('1,000 calories!'), '1000 calories');
});

test('voice: asking for a workout', () => {
  const a = parseCommand('Give me a 30 minute upper body workout with dumbbells');
  assert.equal(a.kind, 'workout');
  if (a.kind !== 'workout') return;
  assert.equal(a.minutes, 30);
  assert.deepEqual(a.focus, ['chest', 'back', 'shoulders', 'biceps', 'triceps']);
  assert.deepEqual(a.equipment, ['dumbbell', 'bodyweight']);

  const legs = parseCommand('quick leg day');
  assert.ok(legs.kind === 'workout' && legs.minutes === 20 && legs.focus.includes('quads'));

  const home = parseCommand('Full body, no equipment, half an hour');
  assert.ok(home.kind === 'workout' && home.minutes === 30 && home.equipment?.includes('bodyweight') && !home.equipment.includes('barbell'));

  const heavy = parseCommand('heavy push session');
  assert.ok(heavy.kind === 'workout' && heavy.goal === 'strength' && heavy.focus.includes('triceps'));

  const back = parseCommand('lets hit upper back');
  assert.ok(back.kind === 'workout' && back.label === 'back');
});

test('voice: logging a set', () => {
  assert.deepEqual(parseCommand('8 reps at 100'), { kind: 'log', reps: 8, weight: 100, rir: null, unit: null });
  assert.deepEqual(parseCommand('one hundred kilos for eight'), { kind: 'log', reps: 8, weight: 100, rir: null, unit: 'kg' });
  assert.deepEqual(parseCommand('Done, two left in the tank'), { kind: 'log', reps: null, weight: null, rir: 2, unit: null });
  assert.deepEqual(parseCommand('10 reps'), { kind: 'log', reps: 10, weight: null, rir: null, unit: null });
  assert.deepEqual(parseCommand('12 reps 60 pounds to failure'), { kind: 'log', reps: 12, weight: 60, rir: 0, unit: 'lb' });
});

test('voice: rest and navigation', () => {
  assert.deepEqual(parseCommand('skip rest'), { kind: 'skipRest' });
  assert.deepEqual(parseCommand('add 30 seconds'), { kind: 'addRest', seconds: 30 });
  assert.deepEqual(parseCommand('give me another minute of rest'), { kind: 'addRest', seconds: 60 });
  assert.deepEqual(parseCommand("What's next?"), { kind: 'next' });
  assert.deepEqual(parseCommand('finish workout'), { kind: 'finish' });
  assert.deepEqual(parseCommand('banana'), { kind: 'unknown' });
});

test('a requested focus overrides recovery', () => {
  const w = generateWorkout(EXERCISES, [], { ...DEFAULT_SETTINGS, equipment: ['dumbbell', 'bodyweight'] }, now, [], ['biceps', 'triceps']);
  assert.deepEqual([...new Set(w.focus)].sort(), ['biceps', 'triceps']);
  assert.ok(w.exercises.every((p) => ['dumbbell', 'bodyweight'].includes(EXERCISES_BY_ID.get(p.exerciseId)!.equipment)));
});
