import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanPrefs, rotationHours, setPref } from './exercisePrefs';
import { EXERCISES } from './exercises';
import { generateWorkout } from './generator';
import { DEFAULT_SETTINGS, type LoggedSet } from './types';

const now = new Date('2026-10-23T12:00:00Z');

test('prefs are cleaned, set and cleared', () => {
  assert.deepEqual(cleanPrefs({ a: 'more', b: 'never', c: 'maybe', d: 3 }), { a: 'more', b: 'never' });
  assert.deepEqual(cleanPrefs(null), {});
  assert.deepEqual(setPref({ a: 'more' }, 'b', 'never'), { a: 'more', b: 'never' });
  assert.deepEqual(setPref({ a: 'more' }, 'a', null), {});
  assert.equal(rotationHours(10, 'more'), 30);
  assert.equal(rotationHours(10, undefined), 10);
});

test("a don't-suggest lift never shows up in a planned workout", () => {
  const first = generateWorkout(EXERCISES, [], DEFAULT_SETTINGS, now).exercises.map((p) => p.exerciseId);
  const banned = first[0];
  const again = generateWorkout(EXERCISES, [], DEFAULT_SETTINGS, now, [], [], { [banned]: 'never' });
  assert.ok(!again.exercises.some((p) => p.exerciseId === banned));
  assert.equal(again.exercises.length, first.length);
});

test('a suggest-more lift comes back sooner than one done longer ago', () => {
  const chest = EXERCISES.filter((e) => e.primary.includes('chest') && e.compound);
  const [fav, other] = chest;
  // Every chest compound was done; the favorite more recently (2 days) than the other (4 days).
  const at = (days: number) => new Date(now.getTime() - days * 864e5).toISOString();
  const history: LoggedSet[] = chest.map((e) => ({ exerciseId: e.id, weight: 100, reps: 8, rir: 2, completedAt: at(e === fav ? 2 : e === other ? 4 : 3.5) }));
  const settings = { ...DEFAULT_SETTINGS, minutes: 75 };
  const plain = generateWorkout(EXERCISES, history, settings, now, [], ['chest']).exercises.map((p) => p.exerciseId);
  const liked = generateWorkout(EXERCISES, history, settings, now, [], ['chest'], { [fav.id]: 'more' }).exercises.map((p) => p.exerciseId);
  assert.equal(plain[0], other.id);
  assert.equal(liked[0], fav.id);
});
