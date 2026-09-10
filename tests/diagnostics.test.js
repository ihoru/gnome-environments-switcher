import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntime } from './helpers.js';

function fixture({ delayOpen = false, failWrite = false } = {}) {
  const state = { text: 'previous logs\n', closes: 0, errors: [], cancelled: false, opens: 0 };
  const stream = {
    write_bytes_async: (bytes, _priority, _cancel, callback) => {
      if (!failWrite) state.text += new TextDecoder().decode(bytes.get_data());
      callback(stream, { length: bytes.get_data().length });
    },
    write_bytes_finish: (result) => {
      if (failWrite) throw new Error('disk full');
      return result.length;
    },
    close_async: (_priority, _cancel, callback) => {
      state.closes++;
      callback(stream, {});
    },
    close_finish() {},
  };
  const file = {
    append_to_async: (flags, _priority, _cancel, callback) => {
      assert.equal(flags, 1);
      state.opens++;
      state.open = () => callback(file, {});
      if (!delayOpen) state.open();
    },
    append_to_finish: () => stream,
  };
  const { DiagnosticLog } = loadRuntime('diagnosticLog.js', ['DiagnosticLog'], {
    Gio: {
      File: { new_for_path: () => file },
      FileCreateFlags: { PRIVATE: 1 },
      Cancellable: class {
        cancel() {
          state.cancelled = true;
        }
      },
    },
    GLib: {
      build_filenamev: (parts) => parts.join('/'),
      get_user_state_dir: () => '/state',
      mkdir_with_parents: () => 0,
      PRIORITY_DEFAULT: 0,
      Bytes: class {
        constructor(data) {
          this.data = data;
        }
        get_data() {
          return this.data;
        }
      },
    },
    TextEncoder,
    console: { error: (error) => state.errors.push(error) },
  });
  const logger = new DiagnosticLog();
  const settle = async () => {
    for (let i = 0; i < 50 && logger._writing; i++)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal(logger._writing, false);
  };
  return { logger, state, settle };
}

test('live log appends ordered events, retains old contents and closes its file stream', async () => {
  const { logger, state, settle } = fixture();
  logger.write('one');
  logger.write('two');
  await settle();
  logger.write('three');
  await settle();
  assert.match(state.text, /^previous logs\n.* one\n.* two\n.* three\n$/);
  assert.equal(state.closes, 2);
  assert.equal(state.opens, 2);
});

test('turning logging off cancels pending operations, closes streams, and ignores later writes', async () => {
  const { logger, state, settle } = fixture({ delayOpen: true });
  logger.write('pending');
  logger.destroy();
  state.open();
  await settle();
  logger.write('after disable');
  assert.equal(state.text, 'previous logs\n');
  assert.equal(state.cancelled, true);
  assert.equal(state.closes, 1);
});

test('file failures preserve earlier data and are reported without recursive logging', async () => {
  const { logger, state, settle } = fixture({ failWrite: true });
  logger.write('event');
  await settle();
  assert.equal(state.text, 'previous logs\n');
  assert.equal(state.errors.length, 1);
  assert.match(state.errors[0], /disk full/);
  assert.equal(state.closes, 1);
});
