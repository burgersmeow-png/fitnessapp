import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeFromUrl, newInstallId, normalizeCode, withCode } from './creatorCode';

test('codes are tidied', () => {
  assert.equal(normalizeCode(' alex 10 '), 'ALEX10');
  assert.equal(normalizeCode('a-b'), null);
  assert.equal(normalizeCode('x'.repeat(21)), null);
});

test('codes come out of creator links', () => {
  assert.equal(codeFromUrl('https://liftlab.app/?code=alex10'), 'ALEX10');
  assert.equal(codeFromUrl('liftlab://welcome?utm=x&ref=SAM%2025'), 'SAM25');
  assert.equal(codeFromUrl('https://liftlab.app/'), null);
  assert.equal(codeFromUrl(null), null);
});

test('install ids match the server format', () => {
  let i = 0;
  const id = newInstallId(() => (i++ % 16) / 16);
  assert.match(id, /^[a-z0-9-]{16,64}$/);
  assert.equal(id.length, 36);
});

test('a creator’s own code is added to links they share, once', () => {
  assert.equal(withCode('https://x.io/?w=abc', 'ALEX10'), 'https://x.io/?w=abc&code=ALEX10');
  assert.equal(withCode('https://x.io/', 'ALEX10'), 'https://x.io/?code=ALEX10');
  assert.equal(withCode('https://x.io/?w=abc&code=SAM1', 'ALEX10'), 'https://x.io/?w=abc&code=SAM1');
  assert.equal(withCode('https://x.io/?w=abc', null), 'https://x.io/?w=abc');
  assert.equal(codeFromUrl(withCode('liftlab://plan?p=xyz', 'ALEX10')), 'ALEX10');
});
