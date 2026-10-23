import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignmentAlert, doneAlert, messageAlert, planDay } from './pushMessages';

const now = new Date(2026, 9, 23, 9);

test('message alerts open the chat with the sender', () => {
  const a = messageAlert({ coach: 'c', client: 'k', text: `  ${'x'.repeat(200)}  ` }, 'Coach Kim');
  assert.equal(a.title, 'Coach Kim');
  assert.equal(a.body.length, 140);
  assert.ok(a.body.endsWith('…'));
  assert.deepEqual(a.data, { path: '/coaching/chat', params: { coach: 'c', client: 'k', name: 'Coach Kim' } });
});

test('assignment and finished alerts', () => {
  assert.equal(planDay('2026-10-23', now), 'today');
  assert.equal(planDay('2026-10-24', now), 'tomorrow');
  assert.equal(planDay('2026-10-26', now), 'Mon, Oct 26');
  assert.equal(assignmentAlert({ title: 'Leg day', scheduled_for: '2026-10-24' }, 'Kim', now).body, 'Leg day, planned for tomorrow.');
  assert.equal(doneAlert({ client: 'k1', title: 'Leg day' }, 'Sam').data.path, '/coaching/client/k1');
});
