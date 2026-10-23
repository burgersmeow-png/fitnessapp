import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPrice, parsePrice, subscriptionLabel } from './payments';

test('prices are read from what a coach types', () => {
  assert.equal(parsePrice('45'), 4500);
  assert.equal(parsePrice('$45.50'), 4550);
  assert.equal(parsePrice('45,5'), 4550);
  assert.equal(parsePrice('0.50'), null);
  assert.equal(parsePrice('5000'), null);
  assert.equal(parsePrice('forty'), null);
  assert.equal(parsePrice('4.555'), null);
});

test('prices show without needless cents', () => {
  assert.match(formatPrice(4500), /^\$45$/);
  assert.match(formatPrice(4550), /^\$45\.50$/);
});

test('subscription labels', () => {
  const until = new Date(2026, 10, 23).toISOString();
  assert.deepEqual(subscriptionLabel({ status: 'active', until, ending: false }).tone, 'good');
  assert.match(subscriptionLabel({ status: 'active', until, ending: false }).text, /^Paid · renews Nov 23$/);
  assert.match(subscriptionLabel({ status: 'active', until, ending: true }).text, /^Ends Nov 23$/);
  assert.equal(subscriptionLabel({ status: 'past_due', until, ending: false }).tone, 'warn');
  assert.equal(subscriptionLabel({ status: 'none', until: null, ending: false }).text, 'Not subscribed');
});
