import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromCm, latestByPart, lengthUnit, saneLength, toCm, type Measurement } from './measurements';

test('lengths convert with the weight units', () => {
  assert.equal(lengthUnit('kg'), 'cm');
  assert.equal(lengthUnit('lb'), 'in');
  assert.equal(toCm(32, 'lb'), 81.28);
  assert.equal(fromCm(81.28, 'lb'), 32);
  assert.equal(fromCm(81.28, 'kg'), 81.3);
  assert.ok(saneLength(81) && !saneLength(800) && !saneLength(0.8));
});

test('latest reading and change per part', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');
  const at = (d: number) => new Date(now - d * 864e5).toISOString();
  const m: Measurement[] = [
    { id: 1, part: 'waist', measuredAt: at(200), value: 90 },
    { id: 2, part: 'waist', measuredAt: at(60), value: 86 },
    { id: 3, part: 'waist', measuredAt: at(1), value: 84.5 },
    { id: 4, part: 'arm', measuredAt: at(3), value: 35 },
  ];
  const l = latestByPart(m, now);
  assert.deepEqual(l.get('waist'), { value: 84.5, change: -1.5 });
  assert.deepEqual(l.get('arm'), { value: 35, change: null });
  assert.equal(l.has('neck'), false);
});
