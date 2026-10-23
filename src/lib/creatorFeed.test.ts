import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanPins, crewCardContent, feedStale, starterLabel, starterPin, isNew, markSeen, mergeFeed, pinRoute, type Pin } from './creatorFeed';

const w: Pin = { kind: 'w', payload: 'WzEsIkxlZyBkYXki', title: 'Leg day' };
const p: Pin = { kind: 'p', payload: 'WzEsIlNwbGl0Il0x', title: 'Split' };
const now = new Date('2026-10-23T12:00:00Z');

test('bad pins from the server are dropped', () => {
  assert.deepEqual(cleanPins([w, { kind: 'x', payload: 'abcdefgh', title: 'No' }, { kind: 'c', payload: 'bad payload!', title: 'No' }, null]), [w]);
  assert.deepEqual(cleanPins([{ kind: 'c', payload: 'abcdefgh12', title: '  ' }]), [{ kind: 'c', payload: 'abcdefgh12', title: 'Challenge' }]);
  assert.deepEqual(cleanPins('nope'), []);
  assert.equal(cleanPins(Array(9).fill(w)).length, 6);
});

test('each pin opens its own screen', () => {
  assert.deepEqual(pinRoute(w), { pathname: '/try', params: { w: w.payload } });
  assert.deepEqual(pinRoute(p), { pathname: '/plan', params: { p: p.payload } });
  assert.equal(pinRoute({ ...w, kind: 'c' }).pathname, '/challenge');
});

test('pins are new only if they arrive after the first look', () => {
  const first = mergeFeed(null, 'Alex', [w], now);
  assert.equal(isNew(first, w), false);
  const later = mergeFeed(first, 'Alex', [p, w], new Date(now.getTime() + 2 * 3600e3));
  assert.equal(isNew(later, p), true);
  assert.equal(isNew(later, w), false);
  assert.equal(isNew(markSeen(later, p), p), false);
  // Unpinned items are forgotten.
  assert.deepEqual(mergeFeed(later, 'Alex', [p], now).seen, []);
});

test('the server is asked at most hourly', () => {
  const feed = mergeFeed(null, 'Alex', [], now);
  assert.equal(feedStale(null, now), true);
  assert.equal(feedStale(feed, new Date(now.getTime() + 30 * 60e3)), false);
  assert.equal(feedStale(feed, new Date(now.getTime() + 61 * 60e3)), true);
});

test('new followers start with the plan, then a workout, then a challenge', () => {
  const c: Pin = { kind: 'c', payload: 'cccccccc', title: '12 in 4 weeks' };
  assert.equal(starterPin([w, c, p]), p);
  assert.equal(starterPin([c, w]), w);
  assert.equal(starterPin([c]), c);
  assert.equal(starterPin([]), null);
  assert.equal(starterLabel('Alex', p), 'Follow Alex’s Split');
  assert.equal(starterLabel('Alex', c), 'Join Alex’s 12 in 4 weeks');
});

test('the crew card leads with my place', () => {
  const top = [
    { place: 1, nickname: 'Jordan', days: 4, me: false },
    { place: 2, nickname: 'Sam', days: 3, me: true },
  ];
  const c = crewCardContent('Alex', top[1], top, 12);
  assert.equal(c.eyebrow, 'ALEX’S CREW · THIS WEEK');
  assert.equal(c.headline, '#2 IN THE CREW');
  assert.deepEqual(c.stats.map((s) => s.value), ['#2', '3', '12']);
  assert.deepEqual(c.lines[1], { name: '2. Sam (me)', detail: '3 days', pr: true });
  assert.equal(crewCardContent('Alex', { ...top[0], me: true }, top, 12).headline, 'TOP OF THE CREW');
  const crowd = [top[0], { place: 2, nickname: 'Mo', days: 3, me: false }, { place: 2, nickname: 'Kat', days: 3, me: false }];
  const late = { place: 2, nickname: 'Sam', days: 3, me: true };
  assert.deepEqual(crewCardContent('Alex', late, [...crowd, late], 12).lines.map((l) => l.name), ['1. Jordan', '2. Mo', '2. Sam (me)']);
});
