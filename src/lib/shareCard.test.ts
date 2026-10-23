import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeCardContent, cardContent, compactNumber, prCardContent, planCardContent, streakCardContent, withCreatorCode, workoutCardContent, type CardInput } from './shareCard';

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

test('a badge card names the badge and how it was earned', () => {
  const c = badgeCardContent({ title: 'Ten down', how: 'Finish 10 workouts.', at: new Date(2026, 9, 23).toISOString(), earned: 4, total: 18, workouts: 10, bestStreak: 0 }, 'en-US');
  assert.equal(c.headline, 'TEN DOWN');
  assert.equal(c.eyebrow, 'BADGE UNLOCKED · OCT 23, 2026');
  assert.deepEqual(c.stats.map((s) => s.value), ['4/18', '10']);
  assert.equal(c.lines[0].detail, 'Finish 10 workouts');
});

test('a streak card leads with the run of weeks', () => {
  const c = streakCardContent({ streak: 6, bestStreak: 4, done: 2, goal: 3, workouts: 21, now: new Date(2026, 9, 23) }, 'en-US');
  assert.equal(c.headline, '6-WEEK STREAK');
  assert.deepEqual(c.stats.map((s) => s.value), ['2/3', '6', '21']);
  assert.equal(c.lines[0].detail, 'Hit 6 weeks in a row');
});

test('a shared workout card lists the lifts and the score to beat', () => {
  const lifts = Array.from({ length: 7 }, (_, i) => ({ id: `l${i}`, name: `Lift ${i + 1}`, sets: 3, reps: 8, rest: 90 }));
  const c = workoutCardContent({ title: 'Leg day', lifts, beat: { volume: 12400, units: 'lb' } });
  assert.equal(c.eyebrow, 'CAN YOU BEAT MY WORKOUT?');
  assert.equal(c.headline, 'LEG DAY');
  assert.deepEqual(c.stats, [{ value: '7', label: 'LIFTS' }, { value: '21', label: 'SETS' }, { value: '12.4K', label: 'LB TO BEAT' }]);
  assert.equal(c.lines.length, 5);
  assert.equal(c.lines[0].detail, '3 × 8');
  assert.equal(c.more, 2);
  const plain = workoutCardContent({ title: ' ', lifts: lifts.slice(0, 1) });
  assert.equal(plain.eyebrow, 'TRY MY WORKOUT');
  assert.equal(plain.headline, 'MY WORKOUT');
  assert.deepEqual(plain.stats.map((s) => s.label), ['LIFT', 'SETS']);
});

test('a plan card lists its days in order', () => {
  const lift = (name: string) => ({ id: name.toLowerCase(), name, sets: 3, reps: 8, rest: 90 });
  const c = planCardContent({
    title: '4-day split',
    days: [
      { title: 'Upper A', lifts: ['Bench', 'Row', 'Press', 'Curl'].map(lift) },
      { title: 'Lower A', lifts: ['Squat', 'RDL'].map(lift) },
    ],
  });
  assert.equal(c.headline, '4-DAY SPLIT');
  assert.deepEqual(c.stats.map((s) => s.value), ['2', '6', '9']);
  assert.deepEqual(c.lines[0], { name: 'Day 1 · Upper A', detail: 'Bench, Row, Press +1', pr: false });
});

test('a creator’s cards carry their code', () => {
  const c = workoutCardContent({ title: 'Leg day', lifts: [{ id: 'squat', name: 'Squat', sets: 3, reps: 5, rest: 120 }] });
  assert.equal(withCreatorCode(c, null), c);
  const coded = withCreatorCode(c, 'ALEX10');
  assert.equal(coded.footer, 'Use code ALEX10 on LiftLab');
  assert.equal(coded.code, 'ALEX10');
});
