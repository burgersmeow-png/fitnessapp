import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liftTrends, trainingDaysPerWeek, trend, trendChange, weightNote } from './progress';

const now = new Date(2026, 9, 23, 12).getTime(); // Friday
const day = (n: number) => now - n * 864e5;

test('the trend smooths daily swings', () => {
  const points = [80, 81.4, 79.6, 80.2].map((v, i) => ({ t: day(3 - i), v }));
  const smooth = trend(points);
  assert.equal(smooth[0].v, 80);
  assert.equal(Math.round(smooth[3].v * 100) / 100, 80.3);
});

test('30-day change and what it means for the goal', () => {
  const points = Array.from({ length: 31 }, (_, i) => ({ t: day(30 - i), v: 82 - i * 0.05 }));
  const change = trendChange(points, 30, now)!;
  assert.ok(change < -1.3 && change > -1.6);
  assert.match(weightNote(change, 'lose', 'kg'), /^Down 1\.\d kg over 30 days\. Right on plan\.$/);
  assert.match(weightNote(change, 'gain', 'kg'), /^Down 1\.\d kg over 30 days\.$/);
  assert.equal(weightNote(0.1, 'maintain', 'kg'), 'Steady over 30 days. Right on plan.');
  assert.equal(trendChange([{ t: day(1), v: 80 }], 30, now), null);
  assert.match(weightNote(null, 'lose', 'kg'), /Weigh in/);
});

test('lift trends: most-trained first, change from first to last fortnight', () => {
  const set = (exerciseId: string, daysAgo: number, weight: number) => ({ exerciseId, weight, reps: 5, rir: 0, completedAt: new Date(day(daysAgo)).toISOString() });
  const history = [
    set('squat', 60, 100), set('squat', 60, 90), set('squat', 40, 105), set('squat', 20, 110), set('squat', 1, 115),
    set('bench', 10, 80), set('bench', 3, 82),
    set('row', 200, 70), // too old
  ];
  const [squat, bench, ...rest] = liftTrends(history, now);
  assert.equal(rest.length, 0);
  assert.equal(squat.exerciseId, 'squat');
  assert.equal(squat.sessions, 4);
  assert.equal(squat.changePct, 15);
  assert.equal(bench.changePct, null); // not enough history to judge
});

test('training days per week, this week last', () => {
  const weeks = trainingDaysPerWeek(
    [new Date(day(0)).toISOString(), new Date(day(0) - 36e5).toISOString(), new Date(day(2)).toISOString(), new Date(day(8)).toISOString()],
    new Date(now),
    4,
  );
  assert.deepEqual(weeks.map((w) => w.days), [0, 0, 1, 2]);
  assert.equal(weeks[3].weekStart.getDay(), 1);
});
