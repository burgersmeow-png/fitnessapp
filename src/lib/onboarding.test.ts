import assert from 'node:assert/strict';
import { test } from 'node:test';
import { goalSettings, needsOnboarding, recommendProgram, suggestedDays, unitsForLocale } from './onboarding';
import { PROGRAM_BY_ID } from './programs';
import { DEFAULT_SETTINGS } from './types';

test('main goals map to training and eating goals', () => {
  assert.deepEqual(goalSettings('lose'), { goal: 'hypertrophy', nutritionGoal: 'lose' });
  assert.deepEqual(goalSettings('strength'), { goal: 'strength', nutritionGoal: 'maintain' });
});

test('program recommendations fit days and experience', () => {
  assert.equal(recommendProgram('muscle', 'new', 4), 'full-body-3');
  assert.equal(recommendProgram('muscle', 'some', 2), 'minimal-2');
  assert.equal(recommendProgram('strength', 'some', 3), 'strength-3');
  assert.equal(recommendProgram('muscle', 'some', 4), 'upper-lower-4');
  assert.equal(recommendProgram('muscle', 'experienced', 6), 'ppl-6');
  assert.equal(recommendProgram('muscle', 'some', 6), 'upper-lower-4');
  for (const main of ['muscle', 'strength', 'lose', 'fit'] as const)
    for (const exp of ['new', 'some', 'experienced'] as const)
      for (let d = 1; d <= 6; d++) assert.ok(PROGRAM_BY_ID.has(recommendProgram(main, exp, d)!));
  assert.equal(suggestedDays('new'), 3);
});

test('units follow the phone region', () => {
  assert.equal(unitsForLocale('en-US'), 'lb');
  assert.equal(unitsForLocale('en-GB'), 'kg');
  assert.equal(unitsForLocale('de-DE'), 'kg');
});

test('only brand-new users see first-run', () => {
  assert.equal(needsOnboarding(DEFAULT_SETTINGS, false), true);
  assert.equal(needsOnboarding(DEFAULT_SETTINGS, true), false);
  assert.equal(needsOnboarding({ ...DEFAULT_SETTINGS, onboarded: true }, false), false);
});
