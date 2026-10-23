import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanPins, feedStale, starterLabel, starterPin, isNew, markSeen, mergeFeed, pinRoute, type Pin } from './creatorFeed';

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
