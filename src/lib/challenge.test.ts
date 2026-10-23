import assert from 'node:assert/strict';
import { test } from 'node:test';
import { challengeCardContent, challengeProgress, challengeUrl, cleanChallenge, decodeChallenge, encodeChallenge, rankBoard, type JoinedChallenge } from './challenge';

const at = (d: number, h = 9) => new Date(2026, 9, d, h).toISOString();
const c: JoinedChallenge = { title: 'October grind', sessions: 4, days: 7, start: '2026-10-05' };

test('challenges round-trip through a link', () => {
  assert.deepEqual(decodeChallenge(encodeChallenge(c)), { title: 'October grind', sessions: 4, days: 7 });
  assert.match(challengeUrl('https://x.io/app', c), /^https:\/\/x\.io\/app\/\?c=[A-Za-z0-9_-]+$/);
  assert.equal(decodeChallenge('???'), null);
});

test('impossible or silly challenges are refused', () => {
  assert.equal(cleanChallenge({ sessions: 10, days: 7 }), null);
  assert.equal(cleanChallenge({ sessions: 1, days: 2 }), null);
  assert.equal(cleanChallenge({ sessions: 5, days: 365 }), null);
  assert.deepEqual(cleanChallenge({ sessions: 10, days: 30, title: '  ' }), { title: '10 in 30 days', sessions: 10, days: 30 });
});

test('counts training days inside the window, once per day', () => {
  const dates = [at(4), at(5), at(5, 18), at(7), at(12), at(13)];
  const p = challengeProgress(c, dates, new Date(2026, 9, 8, 12));
  assert.deepEqual([p.done, p.day, p.daysLeft, p.status, p.lastDay], [2, 4, 3, 'active', '2026-10-11']);
});

test('won as soon as the sessions are in, missed when there are not enough days left', () => {
  const won = challengeProgress(c, [at(5), at(6), at(7), at(8)], new Date(2026, 9, 8, 20));
  assert.equal(won.status, 'won');
  // Day 6 with 1 done: 3 needed, only today and tomorrow left.
  assert.equal(challengeProgress(c, [at(5)], new Date(2026, 9, 10)).status, 'missed');
  // Day 6 with 2 done: today and tomorrow are enough.
  assert.equal(challengeProgress(c, [at(5), at(6)], new Date(2026, 9, 10)).status, 'active');
  assert.equal(challengeProgress(c, [at(5), at(6), at(7)], new Date(2026, 9, 20)).status, 'missed');
});

test('pace compares with sessions spread evenly', () => {
  const big: JoinedChallenge = { title: 't', sessions: 12, days: 28, start: '2026-10-01' };
  assert.equal(challengeProgress(big, [at(1), at(3), at(5)], new Date(2026, 9, 8)).onPace, true);
  assert.equal(challengeProgress(big, [at(1)], new Date(2026, 9, 15)).onPace, false);
});

test('the share card shows the day while active and the result after', () => {
  const p = challengeProgress(c, [at(5), at(6)], new Date(2026, 9, 7));
  const card = challengeCardContent(c, p);
  assert.equal(card.headline, 'DAY 3 OF 7');
  assert.deepEqual(card.stats.map((s) => s.value), ['2/4', '4', '50%']);
  assert.equal(challengeCardContent(c, { ...p, status: 'won', done: 4 }).headline, 'CHALLENGE WON');
});

test('the board ranks by sessions, ties share a place', () => {
  const board = rankBoard(
    [
      { userId: 'a', name: 'Ann', done: 3 },
      { userId: 'b', name: 'Bob', done: 5 },
      { userId: 'c', name: 'Cat', done: 3 },
    ],
    'c',
  );
  assert.deepEqual(board.map((e) => [e.name, e.place, e.me]), [['Bob', 1, false], ['Ann', 2, false], ['Cat', 2, true]]);
});
