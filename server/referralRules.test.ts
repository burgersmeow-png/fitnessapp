import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyCounts, parseClaim, parseStatsRequest, rateLimiter, tokensMatch, validCode } from './referralRules';

test('claims need a real code and install id', () => {
  const installId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  assert.deepEqual(parseClaim({ code: 'ALEX10', installId }), { code: 'ALEX10', installId });
  assert.equal(parseClaim({ code: 'alex10', installId }), null);
  assert.equal(parseClaim({ code: 'ALEX10', installId: 'x' }), null);
  assert.equal(parseClaim(null), null);
  assert.ok(validCode('SAM25') && !validCode('S') && !validCode(null));
});

test('the rate limiter turns away rapid guessing', () => {
  let t = 0;
  const allow = rateLimiter(3, 60_000, () => t);
  assert.deepEqual([allow('ip'), allow('ip'), allow('ip'), allow('ip')], [true, true, true, false]);
  assert.equal(allow('other'), true);
  t = 61_000;
  assert.equal(allow('ip'), true);
});

test('stats requests need a code and a 32-character token', () => {
  const token = 'a'.repeat(32);
  assert.deepEqual(parseStatsRequest({ code: 'ALEX10', token }), { code: 'ALEX10', token });
  assert.equal(parseStatsRequest({ code: 'ALEX10', token: 'short' }), null);
  assert.equal(parseStatsRequest({ code: 'alex10', token }), null);
  assert.equal(parseStatsRequest(null), null);
});

test('tokens compare exactly', () => {
  assert.ok(tokensMatch('abc', 'abc'));
  assert.ok(!tokensMatch('abc', 'abd'));
  assert.ok(!tokensMatch('abc', 'abcd'));
});

test('daily sign-ups fill in empty days', () => {
  const days = dailyCounts(['2026-10-23T08:00:00Z', '2026-10-23T09:00:00Z', '2026-10-21T00:00:00Z', '2026-09-01T00:00:00Z'], new Date('2026-10-23T12:00:00Z'), 3);
  assert.deepEqual(days, [
    { day: '2026-10-21', count: 1 },
    { day: '2026-10-22', count: 0 },
    { day: '2026-10-23', count: 2 },
  ]);
});
