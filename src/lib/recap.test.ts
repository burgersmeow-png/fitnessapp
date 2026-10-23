import assert from 'node:assert/strict';
import { test } from 'node:test';
import { timeStat, recapContent, recapMonth, recapWeek, weekLabel, weekRecapContent, type RecapInput } from './recap';

const at = (d: number, h = 7) => new Date(2026, 9, d, h).toISOString();
const base: RecapInput = {
  month: new Date(2026, 9, 1),
  workouts: [
    { startedAt: at(2), finishedAt: at(2, 8), volume: 9000 },
    { startedAt: at(9), finishedAt: at(9, 8), volume: 9500 },
    { startedAt: new Date(2026, 8, 28).toISOString(), finishedAt: new Date(2026, 8, 28, 1).toISOString(), volume: 7000 },
  ],
  cardio: [{ startedAt: at(5), minutes: 30 }],
  history: [
    { exerciseId: 'squat', weight: 225, reps: 5, rir: null, completedAt: at(2) },
    { exerciseId: 'squat', weight: 225, reps: 5, rir: null, completedAt: at(9) },
    { exerciseId: 'bench', weight: 155, reps: 8, rir: null, completedAt: at(9) },
    { exerciseId: 'row', weight: 135, reps: 8, rir: null, completedAt: at(9) },
    { exerciseId: 'row', weight: 135, reps: 8, rir: null, completedAt: at(9) },
    { exerciseId: 'row', weight: 135, reps: 8, rir: null, completedAt: at(9) },
  ],
  prs: [
    { exerciseId: 'bench', weight: 150, reps: 8, e1rm: 190, gain: 4, at: at(2) },
    { exerciseId: 'bench', weight: 155, reps: 8, e1rm: 196, gain: 6, at: at(9) },
    { exerciseId: 'squat', weight: 225, reps: 5, e1rm: 262, gain: 12, at: at(9) },
  ],
  name: (id) => ({ squat: 'Back Squat', bench: 'Bench Press', row: 'Barbell Row' })[id] ?? id,
  units: 'lb',
};

test('counts only the chosen month', () => {
  const c = recapContent(base, 'en-US')!;
  assert.equal(c.headline, 'OCTOBER');
  assert.equal(c.eyebrow, 'MY MONTH · 2026');
  assert.deepEqual(c.stats, [
    { value: '3', label: 'SESSIONS' },
    { value: '2.5', label: 'HOURS' },
    { value: '18.5K', label: 'LB LIFTED' },
  ]);
});

test('PRs lead with the biggest gain, one per lift, then the most-trained lifts', () => {
  const c = recapContent(base, 'en-US')!;
  assert.deepEqual(c.lines.map((l) => [l.name, l.pr]), [['Back Squat', true], ['Bench Press', true], ['Barbell Row', false]]);
  assert.equal(c.lines[1].detail, '+6 lb est. max · 155 × 8');
  assert.equal(c.lines[2].detail, '3 sets this month');
  assert.match(c.footer, /^2 new PRs/);
});

test('an empty month has no card', () => {
  assert.equal(recapContent({ ...base, month: new Date(2026, 6, 1) }), null);
});

test('the first week recaps last month if there was training', () => {
  assert.equal(recapMonth(new Date(2026, 10, 3), [at(9)]).getMonth(), 9);
  assert.equal(recapMonth(new Date(2026, 10, 3), []).getMonth(), 10);
  assert.equal(recapMonth(new Date(2026, 10, 12), [at(9)]).getMonth(), 10);
});

test('time shows minutes, then hours with a decimal when small', () => {
  assert.deepEqual(timeStat(42), { value: '42', label: 'MINUTES' });
  assert.deepEqual(timeStat(90), { value: '1.5', label: 'HOURS' });
  assert.deepEqual(timeStat(725), { value: '12', label: 'HOURS' });
});

test('a week recap counts Monday to Sunday only', () => {
  // Oct 5 2026 is a Monday; the week holds the Oct 5 cardio and the Oct 9 workout.
  const c = weekRecapContent({ ...base, week: new Date(2026, 9, 7) }, 'en-US')!;
  assert.equal(c.eyebrow, 'MY WEEK · 2026');
  assert.equal(c.headline, 'OCT 5 – 11');
  assert.deepEqual(c.stats[0], { value: '2', label: 'SESSIONS' });
  assert.equal(c.stats[2].value, '9,500');
  assert.deepEqual(c.lines.map((l) => l.name), ['Back Squat', 'Bench Press', 'Barbell Row']);
  assert.equal(c.lines[2].detail, '3 sets this week');
  assert.equal(weekRecapContent({ ...base, week: new Date(2026, 9, 14) }), null);
});

test('week labels name both months across a month end', () => {
  assert.equal(weekLabel(new Date(2026, 8, 28), 'en-US'), 'SEP 28 – OCT 4');
});

test('on an empty Monday the recap is still last week', () => {
  const lastWeek = [new Date(2026, 9, 21, 7).toISOString()];
  assert.equal(recapWeek(new Date(2026, 9, 26, 9), lastWeek).getDate(), 19);
  assert.equal(recapWeek(new Date(2026, 9, 26, 9), [...lastWeek, new Date(2026, 9, 26, 7).toISOString()]).getDate(), 26);
  assert.equal(recapWeek(new Date(2026, 9, 27, 9), lastWeek).getDate(), 26);
});
