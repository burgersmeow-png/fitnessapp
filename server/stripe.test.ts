import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formEncode, paidState, signPayload, verifySignature } from './stripe';

test('nested params are form encoded the way Stripe reads them', () => {
  const body = formEncode({ mode: 'subscription', line_items: [{ price_data: { unit_amount: 4000, recurring: { interval: 'month' } }, quantity: 1 }], skip: undefined });
  assert.equal(
    decodeURIComponent(body),
    'mode=subscription&line_items[0][price_data][unit_amount]=4000&line_items[0][price_data][recurring][interval]=month&line_items[0][quantity]=1',
  );
});

test('webhook signatures must match and be recent', () => {
  const payload = '{"id":"evt_1"}';
  const now = 1_800_000_000;
  const header = signPayload(payload, 'whsec_test', now);
  assert.equal(verifySignature(payload, header, 'whsec_test', now), true);
  assert.equal(verifySignature(payload + ' ', header, 'whsec_test', now), false);
  assert.equal(verifySignature(payload, header, 'whsec_other', now), false);
  assert.equal(verifySignature(payload, header, 'whsec_test', now + 3600), false);
  assert.equal(verifySignature(payload, 'garbage', 'whsec_test', now), false);
});

test('subscription status maps to paid state', () => {
  const end = 1_800_000_000;
  assert.deepEqual(paidState({ id: 's', status: 'active', cancel_at_period_end: false, items: { data: [{ current_period_end: end }] } }), {
    paid_status: 'active',
    paid_until: new Date(end * 1000).toISOString(),
    cancels_at_period_end: false,
  });
  assert.equal(paidState({ id: 's', status: 'past_due', cancel_at_period_end: false }).paid_status, 'past_due');
  assert.equal(paidState({ id: 's', status: 'canceled', cancel_at_period_end: false }).paid_status, 'canceled');
});
