import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GeneratedWorkout } from './generator';
import { deloadWorkout, PROGRAMS, programStep } from './programs';

const at = (id: string, sessionsDone: number) => programStep({ id, startedAt: '2026-10-01T00:00:00Z', sessionsDone })!;

test('every program fills its weeks with days that exist', () => {
  for (const p of PROGRAMS) {
    assert.ok(p.days.length > 0 && p.daysPerWeek % p.days.length === 0, p.id);
    assert.ok(p.days.every((d) => d.focus.length >= 3), p.id);
  }
});

test('progress moves on per session, through weeks and deloads', () => {
  const first = at('upper-lower-4', 0);
  assert.equal(first.day.name, 'Upper');
  assert.deepEqual([first.week, first.dayOfWeek, first.deload, first.finished], [1, 1, false, false]);
  const sixth = at('upper-lower-4', 5);
  assert.deepEqual([sixth.day.name, sixth.week, sixth.dayOfWeek], ['Lower', 2, 2]);
  assert.equal(at('upper-lower-4', 12).deload, true); // week 4
  assert.equal(at('upper-lower-4', 16).deload, false);
  const done = at('upper-lower-4', 32);
  assert.deepEqual([done.finished, done.week, done.progress], [true, 8, 1]);
  assert.equal(programStep({ id: 'gone', startedAt: '', sessionsDone: 0 }), null);
});

test('a deload week trims a set and about 10% of the weight', () => {
  const w: GeneratedWorkout = {
    focus: [],
    recovery: {} as GeneratedWorkout['recovery'],
    exercises: [
      { exerciseId: 'squat', sets: 3, targetReps: 8, targetRir: 2, suggestedWeight: 225, restSeconds: 120, status: 'progressing', deload: false, change: 5 },
      { exerciseId: 'pushup', sets: 2, targetReps: 12, targetRir: 2, suggestedWeight: null, restSeconds: 60, status: 'new', deload: false, change: null },
    ],
  };
  const [squat, pushup] = deloadWorkout(w, 5).exercises;
  assert.deepEqual([squat.sets, squat.suggestedWeight, squat.change], [2, 205, null]);
  assert.deepEqual([pushup.sets, pushup.suggestedWeight], [2, null]);
});
