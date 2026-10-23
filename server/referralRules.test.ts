import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyCounts, dailyOpens, parseClaim, parsePinsRequest, pinFromLink, parseStatsRequest, rateLimiter, tokensMatch, validCode } from './referralRules';

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

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const workout = b64([1, 'Leg day', [['back-squat', 'Back squat', 3, 5, 180]], [12400, 'lb']]);
const plan = b64([1, '', [['Day A', []]]]);

test('pins come from pasted workout, plan and challenge links', () => {
  assert.deepEqual(pinFromLink(`https://x.github.io/fitnessapp/?w=${workout}&code=ALEX10`), { kind: 'w', payload: workout, title: 'Leg day' });
  assert.deepEqual(pinFromLink(`liftlab://plan?p=${plan}`), { kind: 'p', payload: plan, title: 'Training plan' });
  assert.equal(pinFromLink(`https://x/?c=${b64([1, 'Ten in a row', 10, 14])}`)?.title, 'Ten in a row');
  assert.equal(pinFromLink('https://x/?code=ALEX10'), null);
  assert.equal(pinFromLink(`https://x/?w=${b64([2, 'Future'])}`), null);
  assert.equal(pinFromLink(`https://x/?w=${b64({ evil: true })}`), null);
  assert.equal(pinFromLink(`https://x/?w=${workout}<script>`), null);
  assert.equal(pinFromLink(42), null);
});

test('a save request needs the dashboard secret and at most 6 good links', () => {
  const auth = { code: 'ALEX10', token: 'a'.repeat(32) };
  const ok = parsePinsRequest({ ...auth, links: [`?w=${workout}`, '  ', 'not a link', `?p=${plan}`] });
  assert.deepEqual(ok?.pins.map((p) => p.kind), ['w', 'p']);
  assert.deepEqual(ok?.bad, [2]);
  assert.equal(parsePinsRequest({ ...auth, links: Array(7).fill(`?w=${workout}`) }), null);
  assert.equal(parsePinsRequest({ code: 'ALEX10', token: 'nope', links: [] }), null);
  assert.deepEqual(parsePinsRequest({ ...auth, links: [] })?.pins, []);
});

test('link opens are summed per day, old days dropped', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  const d = dailyOpens([{ day: '2026-10-23', opens: 40 }, { day: '2026-10-20', opens: 7 }, { day: '2026-09-01', opens: 99 }], now);
  assert.equal(d.length, 14);
  assert.equal(d[13].count, 40);
  assert.equal(d[10].count, 7);
  assert.equal(d.reduce((n, x) => n + x.count, 0), 47);
});
