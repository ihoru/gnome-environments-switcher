import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntime } from './helpers.js';

function extensionFixture() {
  const state = { focus: null, activations: [], errors: [] };
  const global = {
    display: { get_focus_window: () => state.focus },
    workspace_manager: {},
    get_current_time: () => 1,
  };
  const { EnvironmentsSwitcherExtension: Extension } = loadRuntime(
    'extension.js',
    ['EnvironmentsSwitcherExtension'],
    {
      global,
      Main: { wm: { removeKeybinding() {} } },
      console: { log() {}, error: (e) => state.errors.push(e) },
    },
  );
  const ext = new Extension();
  ext._log = () => {};
  ext._workspacesPerContext = 9;
  ext._activeContext = 'personal';
  ext._activateContextWorkspace = (context, logical, vector) =>
    state.activations.push({ context, logical, vector });
  return { ext, state, global };
}

// Explicit nine-workspace destinations, indexed by the source workspace.
const destinations = {
  '-1': [2, 0, 1, 5, 3, 4, 8, 6, 7],
  1: [1, 2, 0, 4, 5, 3, 7, 8, 6],
  '-3': [6, 7, 8, 0, 1, 2, 3, 4, 5],
  3: [3, 4, 5, 6, 7, 8, 0, 1, 2],
};

function assertWindowStep(count, bank, from, delta, target) {
  const { ext, state } = extensionFixture();
  ext._workspacesPerContext = count;
  const source = bank * count + from;
  let current = source;
  let focused = false;
  state.focus = {
    get_workspace: () => ({ index: () => current }),
    is_on_all_workspaces: () => false,
    activate: () => {
      focused = true;
    },
  };
  ext._moveWindowToContextAndLogical = (_window, context, logical) => {
    current = (context === 'work' ? count : 0) + logical;
  };
  ext._moveFocusedWindowByDirection(delta);
  assert.equal(current, bank * count + target);
  assert.equal(focused, target !== from);
  assert.equal(state.activations.length, target === from ? 0 : 1);
  if (target !== from) {
    assert.equal(state.activations[0].context, bank ? 'work' : 'personal');
    assert.equal(state.activations[0].logical, target);
    assert.equal(state.activations[0].vector.dx, Math.abs(delta) === 1 ? Math.sign(delta) : 0);
    assert.equal(state.activations[0].vector.dy, Math.abs(delta) === 3 ? Math.sign(delta) : 0);
  }
}

test('navigation and window movement cover every workspace, direction, and environment', () => {
  for (const bank of [0, 1])
    for (let from = 0; from < 9; from++)
      for (const delta of [-3, -1, 1, 3]) {
        const target = destinations[delta][from];
        const { ext, state } = extensionFixture();
        ext._activeContext = bank ? 'work' : 'personal';
        ext._activeWorkspaceLogical = () => from;
        ext._stepLogicalWorkspace(delta);
        assert.equal(state.activations[0].context, ext._activeContext);
        assert.equal(state.activations[0].logical, target);
        assert.equal(state.activations[0].vector.dx, Math.abs(delta) === 1 ? Math.sign(delta) : 0);
        assert.equal(state.activations[0].vector.dy, Math.abs(delta) === 3 ? Math.sign(delta) : 0);
        assertWindowStep(9, bank, from, delta, target);
      }
});

test('horizontal steps cycle through existing row cells for every supported count', () => {
  for (let count = 1; count <= 18; count++) {
    const cells = Array.from({ length: count }, (_, index) => index);
    const rows = [];
    while (cells.length) rows.push(cells.splice(0, 3));
    for (const bank of [0, 1])
      for (const row of rows)
        for (const [column, from] of row.entries())
          for (const delta of [-1, 1]) {
            const target =
              delta === -1 ? (row[column - 1] ?? row.at(-1)) : (row[column + 1] ?? row[0]);
            const { ext, state } = extensionFixture();
            ext._workspacesPerContext = count;
            ext._activeContext = bank ? 'work' : 'personal';
            ext._activeWorkspaceLogical = () => from;
            ext._stepLogicalWorkspace(delta);
            assert.equal(state.activations[0].context, ext._activeContext);
            assert.equal(state.activations[0].logical, target);
            assertWindowStep(count, bank, from, delta, target);
          }
  }
});

test('missing, sticky, out-of-bank and failed moves do not follow', () => {
  for (const kind of ['missing', 'sticky', 'outside', 'failed']) {
    const { ext, state } = extensionFixture();
    if (kind !== 'missing')
      state.focus = {
        get_workspace: () => ({ index: () => (kind === 'outside' ? 18 : 0) }),
        is_on_all_workspaces: () => kind === 'sticky',
        activate: () => assert.fail('must not focus'),
      };
    ext._moveWindowToContextAndLogical = () => {};
    ext._moveFocusedWindowByDirection(1);
    assert.equal(state.activations.length, 0);
  }
});

test('small workspace counts preserve positive and negative vertical steps', () => {
  for (const count of [1, 2, 3, 4, 9])
    for (let from = 0; from < count; from++)
      for (const delta of [-3, 3]) {
        const { ext, state } = extensionFixture();
        ext._workspacesPerContext = count;
        ext._activeWorkspaceLogical = () => from;
        ext._stepLogicalWorkspace(delta);
        assert.equal(state.activations[0].logical, (((from + delta) % count) + count) % count);
      }
});

test('numpad and cross-environment moves follow only successful moves', () => {
  for (const failed of [false, true])
    for (const mode of ['numpad', 'other']) {
      const { ext, state } = extensionFixture();
      let current = 0;
      state.focus = {
        get_workspace: () => ({ index: () => current }),
        is_on_all_workspaces: () => false,
        get_id: () => 1,
        activate() {},
      };
      ext._moveWindowToContextAndLogical = (_window, context, logical) => {
        if (!failed) current = (context === 'work' ? 9 : 0) + logical;
      };
      if (mode === 'numpad') ext._moveFocusedWindowToLogicalWorkspace(4);
      else ext._moveFocusedWindowToOtherContext();
      assert.equal(state.activations.length, failed ? 0 : 1);
    }
});

test('enable failure invokes rollback, and cleanup continues after actor failure', () => {
  const { ext, state } = extensionFixture();
  let restored = 0;
  ext._enable = () => {
    throw new Error('partial enable');
  };
  ext._picker = {
    destroy() {
      throw new Error('actor failure');
    },
  };
  ext._desktopTransaction = {
    restore() {
      restored++;
    },
  };
  ext._restoreOverviewStrip = () => {};
  ext._restoreConflictingShortcuts = () => {};
  assert.throws(() => ext.enable(), /partial enable/);
  assert.equal(restored, 1);
  assert.equal(ext._picker, null);
  assert.equal(ext._settings, null);
  assert.equal(state.errors.length, 1);
  ext.disable();
  assert.equal(restored, 1);
});

test('disable releases each signal and actor even when another cleanup fails', () => {
  const actors = [
    '_directionalAnimation',
    '_miniPicker',
    '_picker',
    '_statusLabel',
    '_toggleItem',
    '_moveItem',
    '_indicator',
  ];
  const signals = ['_workspaceChangedId', '_workspaceCountId', '_windowCreatedId'];
  const expected = [...signals, ...actors, 'overview', 'shortcuts', 'settings', 'desktop'];
  for (const failure of [null, ...signals, ...actors]) {
    const { ext, state, global } = extensionFixture();
    const calls = [];
    const cleanup = (name) => {
      calls.push(name);
      if (name === failure) throw new Error(`cleanup failed: ${name}`);
    };
    global.workspace_manager.disconnect = (id) => cleanup(signals[id - 1]);
    global.display.disconnect = (id) => cleanup(signals[id - 1]);
    signals.forEach((field, index) => {
      ext[field] = index + 1;
    });
    actors.forEach((field) => {
      ext[field] = { destroy: () => cleanup(field) };
    });
    ext._restoreOverviewStrip = () => cleanup('overview');
    ext._restoreConflictingShortcuts = () => cleanup('shortcuts');
    ext._settings = {};
    ext._saveSettings = () => cleanup('settings');
    ext._desktopTransaction = { restore: () => cleanup('desktop') };
    ext.disable();
    assert.deepEqual(calls, expected);
    for (const field of signals) assert.equal(ext[field], 0);
    for (const field of actors) assert.equal(ext[field], null);
    assert.equal(ext._desktopTransaction, null);
    assert.equal(ext._settings, null);
    assert.equal(state.errors.length, failure ? 1 : 0);
    calls.length = 0;
    ext.disable();
    assert.deepEqual(calls, ['overview', 'shortcuts']);
  }
});

test('partial indicator setup releases children before their parent', () => {
  const { ext } = extensionFixture();
  const attached = new Set();
  const destroyed = [];
  for (const field of ['_statusLabel', '_toggleItem', '_moveItem']) {
    if (field !== '_moveItem') attached.add(field);
    ext[field] = {
      destroy() {
        assert.ok(!destroyed.includes(field));
        destroyed.push(field);
        attached.delete(field);
      },
    };
  }
  ext._indicator = {
    destroy() {
      for (const field of attached) ext[field].destroy();
      destroyed.push('_indicator');
    },
  };
  ext._restoreOverviewStrip = () => {};
  ext._restoreConflictingShortcuts = () => {};
  ext.disable();
  assert.deepEqual(destroyed, ['_statusLabel', '_toggleItem', '_moveItem', '_indicator']);
});

test('animation cleanup restores compositor and swipe state even if an actor fails', () => {
  let unredirect = 0;
  let completed = 0;
  const errors = [];
  const { DirectionalAnimation, gridDirection } = loadRuntime(
    'directionalAnimation.js',
    ['DirectionalAnimation', 'gridDirection'],
    {
      global: { display: {} },
      Meta: {
        enable_unredirect_for_display() {
          unredirect++;
        },
      },
      console: { error: (error) => errors.push(error) },
    },
  );
  assert.equal(gridDirection(0, 9, 9).dx, 1);
  assert.equal(gridDirection(3, 0, 9).dy, -1);
  const animation = Object.create(DirectionalAnimation.prototype);
  animation._controller = { _swipeTracker: { enabled: false }, movingWindow: {} };
  animation._run = {
    groups: [
      {
        destroy() {
          throw new Error('destroy failed');
        },
      },
    ],
    unredirectDisabled: true,
    swipeEnabled: true,
    onComplete() {
      completed++;
    },
  };
  animation._finish();
  animation._finish();
  assert.equal(unredirect, 1);
  assert.equal(completed, 1);
  assert.equal(animation._controller._swipeTracker.enabled, true);
  assert.equal(errors.length, 1);
});

test('passive preview teardown removes timer, actors and signals', () => {
  const removed = [];
  const disconnected = [];
  let destroyed = 0;
  const { MiniPicker } = loadRuntime('miniPicker.js', ['MiniPicker'], {
    GLib: { Source: { remove: (id) => removed.push(id) } },
    Main: {
      layoutManager: { disconnect: (id) => disconnected.push(id) },
      overview: { disconnect: (id) => disconnected.push(id) },
    },
  });
  const picker = Object.create(MiniPicker.prototype);
  Object.assign(picker, {
    _timeout: 42,
    _frames: [
      {
        destroy() {
          destroyed++;
        },
      },
    ],
    _monitorSignal: 1,
    _overviewSignal: 2,
  });
  picker.destroy();
  assert.deepEqual(removed, [42]);
  assert.equal(destroyed, 1);
  assert.deepEqual(disconnected, [1, 2]);
  assert.equal(picker._extension, null);
});

test('full picker is destroyed synchronously during disable', () => {
  const { WorkspacePicker } = loadRuntime('workspacePicker.js', ['WorkspacePicker']);
  const picker = new WorkspacePicker({});
  let destroyed = 0;
  picker._dialog = {
    destroy() {
      destroyed++;
    },
  };
  picker.destroy();
  assert.equal(destroyed, 1);
  assert.equal(picker._dialog, null);
  assert.equal(picker._extension, null);
});

test('native shortcut backups reject malformed entries without overwriting recovery data', () => {
  const { ext } = extensionFixture();
  const schema = {
    has_key: (key) => key === 'switch',
    get_key: () => ({ get_value_type: () => ({ dup_string: () => 'as' }) }),
  };
  for (const raw of [
    '[]',
    'null',
    '{"switch":{"applied":true,"user":null}}',
    '{"missing":{"applied":[],"user":null}}',
  ]) {
    ext._settings = { get_string: () => raw };
    assert.throws(() => ext._readShortcutBackup({ settings_schema: schema }));
  }
  ext._settings = { get_string: () => '{"switch":{"applied":[],"user":null}}' };
  assert.equal(ext._readShortcutBackup({ settings_schema: schema }).switch.user, null);
});
