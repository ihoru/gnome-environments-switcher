import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntime } from './helpers.js';

function fixture({ held = true, opens = true, physical = false } = {}) {
  let now = 0;
  let nextId = 1;
  const sources = new Map();
  const monitors = new Map();
  const dialogs = [];
  const Clutter = {
    ModifierType: { SUPER_MASK: 1 << 26, MOD4_MASK: 1 << 6 },
    EventType: { KEY_PRESS: 1 },
    KEY_Escape: 27,
    KEY_Return: 13,
    KEY_KP_Enter: 14,
    EVENT_PROPAGATE: false,
    EVENT_STOP: true,
  };
  class Dialog {
    constructor() {
      this.handlers = new Map();
      this.backgroundStack = { hide() {} };
      this.closes = 0;
      dialogs.push(this);
    }
    connect(signal, callback) {
      const handlers = this.handlers.get(signal) ?? [];
      handlers.push(callback);
      this.handlers.set(signal, handlers);
    }
    emit(signal, ...args) {
      for (const fn of this.handlers.get(signal) ?? []) fn(this, ...args);
    }
    open() {
      return opens;
    }
    close() {
      this.closes++;
      this.emit('closed');
      this.destroy();
    }
    destroy() {
      this.emit('destroy');
    }
  }
  const { WorkspacePicker } = loadRuntime('workspacePicker.js', ['WorkspacePicker'], {
    Clutter,
    GLib: {
      PRIORITY_DEFAULT: 0,
      SOURCE_REMOVE: false,
      SOURCE_CONTINUE: true,
      get_monotonic_time: () => now * 1000,
      timeout_add: (_priority, interval, callback) => {
        assert.equal(interval, 50);
        const id = nextId++;
        sources.set(id, callback);
        return id;
      },
      Source: {
        remove: (id) => {
          assert.ok(sources.delete(id), 'source removed exactly once');
        },
      },
    },
    global: {
      get_pointer: () => [
        0,
        0,
        held ? (physical ? Clutter.ModifierType.MOD4_MASK : Clutter.ModifierType.SUPER_MASK) : 0,
      ],
      display: { get_current_monitor: () => 0 },
    },
    Main: {
      layoutManager: {
        monitors: [],
        connect: (_signal, callback) => {
          monitors.set(nextId, callback);
          return nextId++;
        },
        disconnect: (id) => monitors.delete(id),
      },
    },
    ModalDialog: { ModalDialog: Dialog },
  });
  const ext = { _activeWorkspaceIndex: () => 7, _log() {} };
  const picker = new WorkspacePicker(ext);
  const advance = (ms) => {
    for (let i = 0; i < ms; i += 50) {
      now += 50;
      for (const [id, callback] of [...sources]) if (!callback()) sources.delete(id);
    }
  };
  return {
    picker,
    sources,
    monitors,
    dialogs,
    advance,
    hold: (value) => {
      held = value;
    },
    key: (key) =>
      picker._dialog.emit('captured-event', { type: () => 1, get_key_symbol: () => key }),
  };
}

test('picker stays open while Win is held and closes 500 milliseconds after observed release', () => {
  const f = fixture();
  f.picker.toggle();
  f.advance(5000);
  assert.equal(f.dialogs[0].closes, 0);
  f.hold(false);
  f.advance(50); // Poll observes the release.
  f.advance(450);
  assert.equal(f.dialogs[0].closes, 0);
  f.advance(50);
  assert.equal(f.dialogs[0].closes, 1);
  assert.equal(f.picker._selectedPhysical, 7);
  assert.equal(f.picker._dialog, null);
  assert.equal(f.sources.size, 0);
  assert.equal(f.monitors.size, 0);
});

test('pressing Win again resets the release countdown', () => {
  const f = fixture({ held: false });
  f.picker.toggle();
  f.advance(250);
  f.hold(true);
  f.advance(2000);
  assert.equal(f.dialogs[0].closes, 0);
  f.hold(false);
  f.advance(500);
  assert.equal(f.dialogs[0].closes, 0);
  f.advance(50);
  assert.equal(f.dialogs[0].closes, 1);
});

test('opening without Win starts the countdown immediately, and reopening gets a fresh timer', () => {
  const f = fixture({ held: false });
  f.picker.toggle();
  f.advance(450);
  assert.equal(f.dialogs[0].closes, 0);
  f.advance(50);
  assert.equal(f.dialogs[0].closes, 1);
  f.picker.toggle();
  f.advance(450);
  assert.equal(f.dialogs[1].closes, 0);
  f.advance(50);
  assert.equal(f.dialogs[1].closes, 1);
});

test('manual close, monitor changes, external closure and disable cancel the timer', () => {
  for (const close of [
    (f) => f.picker.toggle(),
    (f) => f.key(27),
    (f) => f.key(13),
    (f) => f.key(14),
    (f) => [...f.monitors.values()][0](),
    (f) => f.picker._dialog.close(),
    (f) => f.picker.destroy(),
  ]) {
    const f = fixture();
    f.picker.toggle();
    assert.equal(f.sources.size, 1);
    close(f);
    assert.equal(f.sources.size, 0);
    assert.equal(f.monitors.size, 0);
    f.advance(5000);
    assert.ok(f.dialogs[0].closes <= 1);
  }
});

test('failed open and failure after timer creation leave no observers behind', () => {
  const refused = fixture({ opens: false });
  refused.picker.toggle();
  assert.equal(refused.sources.size, 0);
  assert.equal(refused.monitors.size, 0);
  const failed = fixture();
  failed.picker._extension._log = () => {
    throw new Error('opening failed');
  };
  assert.throws(() => failed.picker.toggle(), /opening failed/);
  assert.equal(failed.sources.size, 0);
  assert.equal(failed.monitors.size, 0);
  assert.equal(failed.picker._dialog, null);
});

test('physical Mod4 state also keeps the picker open until Win is released', () => {
  const f = fixture({ physical: true });
  f.picker.toggle();
  f.advance(3000);
  assert.equal(f.dialogs[0].closes, 0);
  f.hold(false);
  f.advance(550);
  assert.equal(f.dialogs[0].closes, 1);
  assert.equal(f.sources.size, 0);
});

test('picker timeout changes apply while open and zero closes on the next poll', () => {
  const f = fixture({ held: false });
  let delay = 4000;
  f.picker._extension._settings = { get_int: () => delay };
  f.picker.toggle();
  f.advance(2000);
  assert.equal(f.dialogs[0].closes, 0);
  delay = 0;
  f.advance(50);
  assert.equal(f.dialogs[0].closes, 1);
});

test('mini-picker respects its timeout, modifier hold, live edits, and cleanup', () => {
  let now = 0,
    held = true,
    delay = 500,
    callback;
  const { MiniPicker } = loadRuntime('miniPicker.js', ['MiniPicker'], {
    GLib: {
      PRIORITY_DEFAULT: 0,
      SOURCE_REMOVE: false,
      SOURCE_CONTINUE: true,
      get_monotonic_time: () => now * 1000,
      timeout_add: (_p, _ms, fn) => {
        callback = fn;
        return 1;
      },
    },
    global: { get_pointer: () => [0, 0, held ? 3 : 0] },
    Clutter: { ModifierType: { CONTROL_MASK: 1, MOD1_MASK: 2 } },
  });
  const picker = Object.create(MiniPicker.prototype);
  picker._extension = {
    _settings: {
      get_int: (key) => {
        assert.equal(key, 'mini-picker-timeout-ms');
        return delay;
      },
    },
  };
  let hidden = 0;
  picker.hide = () => hidden++;
  picker._startAutoHide();
  now = 2000;
  assert.equal(callback(), true);
  held = false;
  assert.equal(callback(), true);
  now = 2450;
  assert.equal(callback(), true);
  delay = 1000;
  now = 2600;
  assert.equal(callback(), true);
  now = 3000;
  assert.equal(callback(), false);
  assert.equal(hidden, 1);
  assert.equal(picker._timeout, 0);
});
