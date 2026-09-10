import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsTransaction } from '../src/settingsTransaction.js';

function fixture(user = null) {
  let stored = '{}';
  let current = user ?? false;
  let explicit = user;
  const writes = [];
  const storage = {
    read: () => stored,
    write: (value) => {
      stored = value;
      writes.push('backup');
    },
  };
  const adapter = {
    valid: (value) => typeof value === 'boolean',
    read: () => current,
    user: () => explicit,
    write: (value) => {
      current = value;
      explicit = value;
      writes.push('desktop');
    },
    reset: () => {
      current = false;
      explicit = null;
    },
  };
  return {
    storage,
    adapter,
    writes,
    value: () => current,
    user: () => explicit,
    setRaw: (value) => {
      stored = value;
    },
    transaction: () => new SettingsTransaction(storage, { isolation: adapter }),
  };
}

test('backup is durable before applying; unset defaults are restored as unset', () => {
  const f = fixture();
  const tx = f.transaction();
  tx.apply('isolation', true);
  assert.deepEqual(f.writes, ['backup', 'desktop']);
  tx.restore();
  assert.equal(f.value(), false);
  assert.equal(f.user(), null);
  assert.equal(f.storage.read(), '{}');
});

test('explicit false survives a restart and repeated apply', () => {
  const f = fixture(false);
  f.transaction().apply('isolation', true);
  const restarted = f.transaction();
  restarted.apply('isolation', true);
  restarted.restore();
  assert.equal(f.user(), false);
});

test('subsequent user edit is preserved on disable and crash recovery', () => {
  for (const restart of [false, true]) {
    const f = fixture();
    const tx = f.transaction();
    tx.apply('isolation', true);
    f.adapter.write(false);
    const next = restart ? f.transaction() : tx;
    if (restart) assert.equal(next.apply('isolation', true), false);
    next.restore();
    assert.equal(f.user(), false);
  }
});

test('invalid backup is preserved, not silently reset', () => {
  for (const raw of [
    'bad json',
    '[]',
    'null',
    '{"unknown":{}}',
    '{"isolation":{"applied":"yes","user":null}}',
  ]) {
    const f = fixture();
    f.setRaw(raw);
    assert.throws(() => f.transaction());
    assert.equal(f.storage.read(), raw);
    assert.equal(f.value(), false);
  }
});

test('failed restore retains recovery data and continues with other settings', () => {
  const f = fixture();
  const errors = [];
  const second = {
    ...f.adapter,
    reset: () => {
      throw new Error('locked');
    },
  };
  const tx = new SettingsTransaction(f.storage, { isolation: f.adapter, second }, (e) =>
    errors.push(e),
  );
  tx.apply('isolation', true);
  // Separate entry on the same adapter is enough to test independent rollback execution.
  f.setRaw('{"isolation":{"user":null,"applied":true},"second":{"user":null,"applied":true}}');
  new SettingsTransaction(f.storage, { isolation: f.adapter, second }, (e) =>
    errors.push(e),
  ).restore();
  assert.equal(errors.length, 1);
  assert.equal(f.value(), false);
  assert.deepEqual(Object.keys(JSON.parse(f.storage.read())), ['second']);
});

test('unavailable optional schema keeps backup for later restoration', () => {
  const f = fixture();
  f.transaction().apply('isolation', true);
  f.adapter.available = false;
  f.transaction().restore();
  assert.notEqual(f.storage.read(), '{}');
  f.adapter.available = true;
  f.transaction().restore();
  assert.equal(f.user(), null);
});

test('failed backup write prevents desktop mutation', () => {
  const f = fixture();
  f.storage.write = () => {
    throw new Error('read only');
  };
  assert.throws(() => f.transaction().apply('isolation', true));
  assert.equal(f.value(), false);
});

test('backup-storage failure during restore retains the in-memory recovery entry', () => {
  const f = fixture();
  const tx = f.transaction();
  tx.apply('isolation', true);
  const originalWrite = f.storage.write;
  f.storage.write = () => {
    throw new Error('disk unavailable');
  };
  tx.restore();
  f.storage.write = originalWrite;
  tx.restore();
  assert.equal(f.storage.read(), '{}');
  assert.equal(f.value(), false);
});
