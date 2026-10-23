import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beforeAfter, photoCardContent, spanLabel, weightNear } from './progressPhotos';

const photo = (id: number, takenAt: string) => ({ id, takenAt, uri: `data:image/jpeg;base64,${id}` });

test('before and after are the first and latest photos, a day or more apart', () => {
  const a = photo(1, '2026-07-01T08:00:00Z');
  const b = photo(2, '2026-08-01T08:00:00Z');
  const c = photo(3, '2026-10-20T08:00:00Z');
  assert.deepEqual(beforeAfter([b, c, a]), { before: a, after: c });
  assert.equal(beforeAfter([a]), null);
  assert.equal(beforeAfter([a, photo(4, '2026-07-01T20:00:00Z')]), null);
});

test('the gap reads in days, then weeks, then months', () => {
  assert.deepEqual(spanLabel('2026-10-01', '2026-10-10'), { value: '9', label: 'DAYS' });
  assert.deepEqual(spanLabel('2026-07-01', '2026-09-23'), { value: '12', label: 'WEEKS' });
  assert.deepEqual(spanLabel('2025-08-01', '2026-10-01'), { value: '14', label: 'MONTHS' });
});

test('weight near a photo uses the closest weigh-in within a week', () => {
  const w = [
    { measuredAt: '2026-07-03T07:00:00Z', weight: 190 },
    { measuredAt: '2026-07-20T07:00:00Z', weight: 187 },
  ];
  assert.equal(weightNear(w, '2026-07-01T08:00:00Z'), 190);
  assert.equal(weightNear(w, '2026-08-10T08:00:00Z'), null);
});

test('the card shows the gap, workouts and body weight change', () => {
  const c = photoCardContent(
    {
      before: photo(1, '2026-07-01T08:00:00Z'),
      after: photo(2, '2026-09-23T08:00:00Z'),
      weights: [
        { measuredAt: '2026-07-01T07:00:00Z', weight: 190 },
        { measuredAt: '2026-09-22T07:00:00Z', weight: 181.6 },
      ],
      workouts: 34,
      units: 'lb',
    },
    'en-US',
  );
  assert.equal(c.headline, '12 WEEKS APART');
  assert.deepEqual(c.stats, [
    { value: '12', label: 'WEEKS' },
    { value: '34', label: 'WORKOUTS' },
    { value: '8.4', label: 'LB DOWN' },
  ]);
  assert.equal(c.photos?.before.label, 'JUL 1, 2026');
  assert.equal(c.lines.length, 0);
  const none = photoCardContent({ before: photo(1, '2026-07-01'), after: photo(2, '2026-07-20'), weights: [], workouts: 0, units: 'kg' });
  assert.deepEqual(none.stats, [{ value: '3', label: 'WEEKS' }]);
});
