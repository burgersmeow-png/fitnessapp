import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advancePlan, decodePlan, encodePlan, followPlan, planUrl, samePlan, type PlanLink } from './planLink';
import { toBase64Url } from './workoutLink';

const lift = (id: string, name: string) => ({ id, name, sets: 3, reps: 8, rest: 120 });
const split: PlanLink = {
  title: 'Alex’s 3-day split',
  days: [
    { title: 'Push', lifts: [lift('bb-bench', 'Barbell Bench Press')] },
    { title: 'Pull', lifts: [lift('bb-row', 'Barbell Row')] },
    { title: 'Legs', lifts: [lift('back-squat', 'Back Squat')] },
  ],
};

test('a plan round-trips through a link', () => {
  assert.deepEqual(decodePlan(encodePlan(split)), split);
  assert.match(planUrl('https://x.io/', split), /^https:\/\/x\.io\/\?p=[A-Za-z0-9_-]+$/);
});

test('days without names get numbered, and bad plans are refused', () => {
  const p = decodePlan(toBase64Url(JSON.stringify([1, '', [['', [['bb-bench', 'Bench', 3, 8, 90]]]]])))!;
  assert.equal(p.title, '1-day plan');
  assert.equal(p.days[0].title, 'Day 1');
  assert.equal(decodePlan(toBase64Url(JSON.stringify([1, 'x', []]))), null);
  assert.equal(decodePlan(toBase64Url(JSON.stringify([1, 'x', [['A', [['BAD!', 'B', 3, 8, 90]]]]]))), null);
  assert.equal(decodePlan('nope!'), null);
});

test('following rotates through the days in order', () => {
  let f = followPlan(split, new Date(0));
  assert.equal(f.days[f.next].title, 'Push');
  f = advancePlan(advancePlan(f));
  assert.equal(f.days[f.next].title, 'Legs');
  f = advancePlan(f);
  assert.equal(f.days[f.next].title, 'Push');
  assert.equal(f.done, 3);
  assert.ok(samePlan(f, split));
});
