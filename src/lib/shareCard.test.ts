import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardContent, compactNumber, prCardContent, type CardInput } from './shareCard';

const base: CardInput = {
  startedAt: new Date(2026, 9, 23, 7).toISOString(),
  minutes: 52,
  sets: 18,
  volume: 12345,
  units: 'lb',
  prs: [],
  exercises: [
    { name: 'Back Squat', sets: 4, best: { weight: 225, reps: 5 } },
    { name: 'Barbell Bench Press', sets: 4, best: { weight: 185, reps: 8 } },
    { name: 'Pull-Up', sets: 3, best: { weight: null, reps: 10 } },
  ],
};

test('numbers shrink to fit a big stat', () => {
  assert.equal(compactNumber(950), '950');
  assert.equal(compactNumber(9999), '9,999');
  assert.equal(compactNumber(12345), '12.3K');
  assert.equal(compactNumber(1250000), '1.25M');
});

test('a plain workout card', () => {
  const c = cardContent(base, 'en-US');
  assert.equal(c.headline, 'WORKOUT DONE');
  assert.equal(c.eyebrow, 'WORKOUT · FRI, OCT 23');
  assert.deepEqual(c.stats.map((s) => s.value), ['52', '18', '12.3K']);
  assert.equal(c.lines[2].detail, '3 sets · 10 reps');
  assert.equal(c.more, 0);
});

test('PR lifts lead and long workouts are trimmed', () => {
  const many = [...base.exercises, ...['A', 'B', 'C', 'D'].map((n) => ({ name: n, sets: 3, best: { weight: 50, reps: 10 } }))];
  const c = cardContent({ ...base, prs: ['Barbell Bench Press', 'D'], exercises: many, streak: 4 }, 'en-US');
  assert.equal(c.headline, '2 NEW PRS');
  assert.deepEqual(c.lines.slice(0, 2).map((l) => [l.name, l.pr]), [['Barbell Bench Press', true], ['D', true]]);
  assert.equal(c.lines.length, 5);
  assert.equal(c.more, 2);
});

test('a single PR card leads with the lift and shows the gain', () => {
  const c = prCardContent({ exercise: 'Back Squat', weight: 245, reps: 5, e1rm: 285.8, gain: 12.2, at: new Date(2026, 9, 23, 7).toISOString(), units: 'lb' }, 'en-US');
  assert.equal(c.headline, 'NEW PR');
  assert.match(c.eyebrow, /^PERSONAL RECORD · FRI, OCT 23$/);
  assert.deepEqual(c.stats.map((s) => s.value), ['245', '286', '+12']);
  assert.equal(c.stats[0].label, 'LB × 5 REPS');
  assert.deepEqual(c.lines[0], { name: 'Back Squat', detail: '245 lb × 5', pr: true });
  assert.equal(c.lines[1].detail, 'Est. max 274 lb');
});

test('a one-rep PR says REP, not REPS', () => {
  const c = prCardContent({ exercise: 'Deadlift', weight: 180, reps: 1, e1rm: 180, gain: 5, at: new Date().toISOString(), units: 'kg' });
  assert.equal(c.stats[0].label, 'KG × 1 REP');
});
