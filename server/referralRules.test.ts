import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAlert, chunks, crewMemberId, parseCrewHide, crewBoard, crewWeek, parseCrewJoin, parseCrewSync, dailyCounts, dailyOpens, newPins, parseClaim, parsePushRequest, parseUseRequest, pinAlert, pinHash, pinsWithUses, parsePinsRequest, pinFromLink, parseStatsRequest, rateLimiter, tokensMatch, validCode } from './referralRules';

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

test('push sign-ups need an install id and an Expo token', () => {
  const installId = 'abcdef0123456789';
  assert.deepEqual(parsePushRequest({ installId, token: 'ExponentPushToken[xyz]' }), { installId, token: 'ExponentPushToken[xyz]' });
  assert.equal(parsePushRequest({ installId, token: 'https://evil' }), null);
  assert.equal(parsePushRequest({ installId: 'short', token: 'ExpoPushToken[xyz]' }), null);
});

test('followers hear about new pins only, at most twice a day', () => {
  const a = { kind: 'w' as const, payload: 'aaaaaaaa', title: 'Leg day' };
  const b = { kind: 'p' as const, payload: 'bbbbbbbb', title: 'Split' };
  assert.deepEqual(newPins([a], [b, a]), [b]);
  assert.deepEqual(newPins([a, b], [a]), []);
  const now = new Date('2026-10-23T12:00:00Z');
  assert.equal(canAlert(null, now), true);
  assert.equal(canAlert('2026-10-23T06:00:00Z', now), false);
  assert.equal(canAlert('2026-10-22T23:00:00Z', now), true);
  assert.deepEqual(pinAlert('Alex', [b]), { title: 'Alex posted a new plan', body: 'Split', data: { kind: 'creator', path: '/plan', params: { p: 'bbbbbbbb' } } });
  assert.equal(pinAlert('Alex', [a, b]).title, 'Alex posted 2 new things');
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('pin uses are counted per pin', () => {
  const a = { kind: 'w' as const, payload: 'aaaaaaaa', title: 'Leg day' };
  const b = { kind: 'c' as const, payload: 'bbbbbbbb', title: 'Ten' };
  assert.match(pinHash('aaaaaaaa'), /^[a-f0-9]{64}$/);
  const rows = [{ pin_hash: pinHash('aaaaaaaa') }, { pin_hash: pinHash('aaaaaaaa') }, { pin_hash: pinHash('zzzzzzzz') }];
  assert.deepEqual(pinsWithUses([a, b], rows).map((p) => p.uses), [2, 0]);
  assert.deepEqual(parseUseRequest({ installId: 'abcdef0123456789', payload: 'aaaaaaaa' }), { installId: 'abcdef0123456789', payload: 'aaaaaaaa' });
  assert.equal(parseUseRequest({ installId: 'abcdef0123456789', payload: '<b>' }), null);
});

test('crew nicknames are short, plain and not impersonating', () => {
  const installId = 'abcdef0123456789';
  assert.deepEqual(parseCrewJoin({ installId, nickname: '  Sam   B ' }), { installId, nickname: 'Sam B' });
  assert.equal(parseCrewJoin({ installId, nickname: 'S' }), null);
  assert.equal(parseCrewJoin({ installId, nickname: '<script>' }), null);
  assert.equal(parseCrewJoin({ installId, nickname: 'LiftLab_Official' }), null);
  assert.equal(parseCrewJoin({ installId, nickname: 'x'.repeat(21) }), null);
  assert.deepEqual(parseCrewSync({ installId, days: 3 }), { installId, days: 3 });
  assert.equal(parseCrewSync({ installId, days: 9 }), null);
  assert.equal(parseCrewSync({ installId, days: 1.5 }), null);
});

test('the crew week starts on Monday (UTC)', () => {
  assert.equal(crewWeek(new Date('2026-10-23T12:00:00Z')), '2026-10-19');
  assert.equal(crewWeek(new Date('2026-10-19T00:30:00Z')), '2026-10-19');
  assert.equal(crewWeek(new Date('2026-10-18T23:30:00Z')), '2026-10-12');
});

test('the crew board ranks by days, ties share a place, and shows me if I am further down', () => {
  const row = (id: string, days: number, at: string) => ({ install_id: id, nickname: id.toUpperCase(), days, updated_at: at });
  const rows = [row('a', 3, '2026-10-21'), row('b', 5, '2026-10-22'), row('c', 3, '2026-10-20'), row('d', 1, '2026-10-20'), row('e', 0, '2026-10-20')];
  const board = crewBoard(rows, 'd', 2);
  assert.deepEqual(board.top.map((p) => [p.nickname, p.place]), [['B', 1], ['C', 2]]);
  assert.deepEqual(board.me, { place: 4, nickname: 'D', days: 1, me: true });
  assert.equal(board.total, 4);
  assert.equal(crewBoard(rows, 'e').me?.days, 0);
  assert.equal(crewBoard(rows, 'zzz').me, null);
});

test('creators hide crew members by an id that does not reveal the install', () => {
  const id = crewMemberId('abcdef0123456789');
  assert.match(id, /^[a-f0-9]{16}$/);
  assert.notEqual(id, crewMemberId('abcdef0123456780'));
  const auth = { code: 'ALEX10', token: 'a'.repeat(32) };
  assert.deepEqual(parseCrewHide({ ...auth, id, hidden: true }), { ...auth, id, hidden: true });
  assert.equal(parseCrewHide({ ...auth, id: 'abcdef0123456789', hidden: 'yes' }), null);
  assert.equal(parseCrewHide({ ...auth, id: 'not-hex', hidden: true }), null);
});
