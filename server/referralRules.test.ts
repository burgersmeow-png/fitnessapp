import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClaim, rateLimiter, validCode } from './referralRules';

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
