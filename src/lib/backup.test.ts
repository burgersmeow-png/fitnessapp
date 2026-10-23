import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backupDue, makeBackup, parseBackup, summarize, summaryLine, type BackupTable, type Row } from './backup';

const tables: Record<BackupTable, Row[]> = {
  exercises: [{ id: 'bench', custom: 0 }, { id: 'my-lift', custom: 1 }],
  workouts: [{ id: 1, started_at: 'a', finished_at: 'b' }, { id: 2, started_at: 'c', finished_at: null }],
  sets: [{ id: 1, workout_id: 1, completed_at: 'x' }, { id: 2, workout_id: 2, completed_at: null }],
  cardio: [{ id: 1 }],
  food: [],
  body_weights: [],
  body_measurements: [],
  settings: [{ key: 'settings', value: '{}' }, { key: 'install-id', value: '"abc"' }],
};

test('a backup keeps your own lifts and records, not the phone’s', () => {
  const b = makeBackup(tables, new Date('2026-10-23T12:00:00Z'));
  assert.deepEqual(b.tables.exercises.map((e) => e.id), ['my-lift']);
  assert.deepEqual(b.tables.settings.map((s) => s.key), ['settings']);
  assert.deepEqual(summarize(b), { at: '2026-10-23T12:00:00.000Z', workouts: 1, sets: 1, cardio: 1, meals: 0 });
  assert.equal(summaryLine(summarize(b)), '1 workout, 1 set, 1 cardio session');
});

test('only well-formed backups can be restored', () => {
  const b = makeBackup(tables, new Date());
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(b))), b);
  assert.equal(parseBackup(null), null);
  assert.equal(parseBackup({ ...b, v: 2 }), null);
  assert.equal(parseBackup({ ...b, tables: { ...b.tables, sets: 'nope' } }), null);
  assert.equal(parseBackup({ ...b, tables: { ...b.tables, sets: [{ 'id; drop table sets': 1 }] } }), null);
  assert.equal(parseBackup({ ...b, tables: { ...b.tables, sets: [{ id: { nested: true } }] } }), null);
  // A table missing from an older backup restores as empty.
  const { food, ...rest } = b.tables;
  assert.deepEqual(parseBackup({ ...b, tables: rest })?.tables.food, []);
});

test('automatic backups run once a day at most', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  assert.equal(backupDue(null, now), true);
  assert.equal(backupDue('2026-10-23T01:00:00Z', now), false);
  assert.equal(backupDue('2026-10-22T11:00:00Z', now), true);
});
