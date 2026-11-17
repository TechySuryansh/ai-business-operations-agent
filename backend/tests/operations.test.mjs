import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreTarget } from '../scripts/integrity.mjs';
import { origin } from '../scripts/env.mjs';
test('restore refuses production-like names and the source database', () => {
  const source = 'postgresql://user:secret@db.example:5432/postgres';
  assert.throws(() => restoreTarget(source, source));
  assert.throws(() => restoreTarget(source, 'postgresql://user:secret@other.example/production'));
  assert.throws(() =>
    restoreTarget(
      'postgresql://a@db.example/nexus_restore_test',
      'postgresql://b@db.example:5432/nexus_restore_test',
    ),
  );
  assert.equal(
    restoreTarget(source, 'postgresql://user:secret@localhost/nexus_restore_test'),
    'nexus_restore_test',
  );
});
test('public origins reject embedded secrets, paths and remote plain HTTP', () => {
  for (const value of [
    'https://user:secret@example.com',
    'https://example.com/private',
    'http://example.com',
    'https://example.com?token=secret',
    'file:///tmp/data',
  ])
    assert.throws(() => origin(value));
  assert.equal(origin('https://example.com'), 'https://example.com');
  assert.equal(origin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
});
