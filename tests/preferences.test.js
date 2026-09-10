import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHORTCUT_GROUPS, validateName, validateShortcuts } from '../src/preferencesModel.js';
import { loadRuntime } from './helpers.js';

const keys = SHORTCUT_GROUPS.flatMap(({ actions }) => actions.map(([key]) => key));

test('preferences expose every existing shortcut and no internal or workspace-count setting', () => {
  const schema = readFileSync(
    new URL(
      '../src/schemas/org.gnome.shell.extensions.environments-switcher.gschema.xml',
      import.meta.url,
    ),
    'utf8',
  );
  const shortcuts = [...schema.matchAll(/<key name="([^"]+)" type="as">/g)].map((m) => m[1]);
  assert.deepEqual([...keys].sort(), shortcuts.sort());
  assert.equal(new Set(keys).size, keys.length);
});

test('names trim whitespace, accept Unicode and reject blanks', () => {
  assert.equal(validateName('  Дом  '), 'Дом');
  assert.equal(validateName('Home & family'), 'Home & family');
  for (const value of ['', '   ', '\n\t']) assert.throws(() => validateName(value));
});

test('shortcut alternatives, disabling, collisions, invalid input and reset validate atomically', () => {
  const settings = { get_strv: (key) => (key === 'toggle-context' ? ['<Ctrl>a'] : []) };
  const canonical = (value) => (value === 'invalid' ? null : value.replace('Primary', 'Ctrl'));
  const key = 'environment-picker';
  assert.deepEqual(validateShortcuts(settings, key, [], canonical), []);
  assert.deepEqual(validateShortcuts(settings, key, ['<Ctrl>b', '<Ctrl>c'], canonical), [
    '<Ctrl>b',
    '<Ctrl>c',
  ]);
  assert.throws(
    () => validateShortcuts(settings, key, ['<Primary>a'], canonical),
    /Already assigned/,
  );
  assert.throws(
    () => validateShortcuts(settings, key, ['<Ctrl>b', '<Primary>b'], canonical),
    /already uses/,
  );
  assert.throws(() => validateShortcuts(settings, key, ['invalid'], canonical), /valid shortcut/);
  // An unchanged default or a second alias belonging to this action is allowed.
  assert.deepEqual(
    validateShortcuts(settings, 'toggle-context', ['<Ctrl>a', '<Ctrl>b'], canonical),
    ['<Ctrl>a', '<Ctrl>b'],
  );
});

function shortcutFixture() {
  const values = { native: ['<Ctrl>a', '<Ctrl>b', '<Ctrl>c'] };
  let explicit = null;
  let backup = '{}';
  let selected = ['<Ctrl>a', '<Ctrl>b'];
  const schema = {
    list_keys: () => ['native'],
    has_key: (key) => key === 'native',
    get_key: () => ({ get_value_type: () => ({ dup_string: () => 'as' }) }),
  };
  class Settings {
    settings_schema = schema;
    get_strv(key) {
      return values[key];
    }
    get_user_value() {
      return explicit === null ? null : { deep_unpack: () => explicit };
    }
    set_strv(key, value) {
      values[key] = [...value];
      explicit = [...value];
      return true;
    }
    is_writable() {
      return true;
    }
    reset() {
      values.native = ['<Ctrl>a', '<Ctrl>b', '<Ctrl>c'];
      explicit = null;
    }
    static sync() {}
  }
  const removed = [];
  const notices = [];
  const { EnvironmentsSwitcherExtension: Extension } = loadRuntime(
    'extension.js',
    ['EnvironmentsSwitcherExtension'],
    {
      Gio: { Settings },
      Main: {
        wm: { removeKeybinding: (key) => removed.push(key) },
        notifyError: (...args) => notices.push(args),
      },
    },
  );
  const ext = new Extension();
  ext._log = () => {};
  ext._releasedNativeShortcuts = new Set();
  ext._settings = {
    get_strv: () => selected,
    get_string: () => backup,
    set_string: (_key, value) => {
      backup = value;
      return true;
    },
  };
  ext._installKeybindings = () => {
    ext._suspendConflictingShortcuts(['action']);
    ext._bindings.push('action');
  };
  return {
    ext,
    values,
    removed,
    notices,
    settings: new Settings(),
    backup: () => JSON.parse(backup),
    choose: (value) => {
      selected = value;
    },
  };
}

test('live rebinding restores released native alternatives and keeps the original default state', () => {
  const f = shortcutFixture();
  f.ext._installKeybindings();
  assert.deepEqual(f.values.native, ['<Ctrl>c']);
  f.choose(['<Ctrl>c']);
  f.ext._refreshKeybindings();
  assert.deepEqual(f.values.native, ['<Ctrl>a', '<Ctrl>b']);
  assert.equal(f.backup().native.user, null);
  f.choose([]);
  f.ext._refreshKeybindings();
  assert.deepEqual(f.values.native, ['<Ctrl>a', '<Ctrl>b', '<Ctrl>c']);
  assert.deepEqual(f.backup(), {});
  assert.deepEqual(f.removed, ['action', 'action']);
});

test('live rebinding respects subsequent manual native edits across repeated changes', () => {
  const f = shortcutFixture();
  f.ext._installKeybindings();
  f.settings.set_strv('native', ['<Ctrl>b', '<Ctrl>z']);
  for (const chosen of [['<Ctrl>b'], ['<Ctrl>z'], ['<Ctrl>b']]) {
    f.choose(chosen);
    f.ext._refreshKeybindings();
    assert.deepEqual(f.values.native, ['<Ctrl>b', '<Ctrl>z']);
  }
  f.ext._restoreConflictingShortcuts();
  assert.deepEqual(f.values.native, ['<Ctrl>b', '<Ctrl>z']);
});

test('failed registration cleans partial bindings and restores native shortcuts', () => {
  const f = shortcutFixture();
  f.ext._installKeybindings();
  const install = f.ext._installKeybindings;
  f.ext._installKeybindings = () => {
    install();
    throw new Error('registration failed');
  };
  assert.throws(() => f.ext._refreshKeybindings(), /registration failed/);
  assert.equal(f.ext._bindings.length, 0);
  assert.deepEqual(f.values.native, ['<Ctrl>a', '<Ctrl>b', '<Ctrl>c']);
  assert.deepEqual(f.backup(), {});
});

test('settings observer routes only preferences, reports failure, and disconnects before restoration', () => {
  const f = shortcutFixture();
  const calls = [];
  let changed;
  f.ext._bindings = ['action'];
  f.ext._settings.connect = (_signal, callback) => {
    changed = callback;
    return 42;
  };
  f.ext._settings.disconnect = (id) => {
    assert.equal(id, 42);
    calls.push('disconnect');
  };
  f.ext._watchPreferences();
  f.ext._updateEnvironmentNames = () => calls.push('rename');
  f.ext._refreshKeybindings = () => {
    throw new Error('locked');
  };
  changed(null, 'environment-name-work');
  changed(null, 'active-context');
  changed(null, 'action');
  assert.deepEqual(calls, ['rename']);
  assert.equal(f.notices.length, 1);
  f.ext._restoreOverviewStrip = () => {};
  f.ext._saveSettings = () => {};
  f.ext._restoreConflictingShortcuts = () => calls.push('restore');
  f.ext.disable();
  assert.deepEqual(calls, ['rename', 'disconnect', 'restore']);
  assert.equal(f.ext._preferencesSignal, 0);
});

test('real registration covers all preference actions and detects a refused binding', () => {
  const registered = [];
  let refuse = false;
  const { EnvironmentsSwitcherExtension: Extension } = loadRuntime(
    'extension.js',
    ['EnvironmentsSwitcherExtension'],
    {
      Meta: { KeyBindingFlags: { NONE: 0 }, KeyBindingAction: { NONE: 0 } },
      Shell: { ActionMode: { NORMAL: 1, OVERVIEW: 2, POPUP: 4 } },
      Main: {
        wm: {
          addKeybinding: (key) => {
            registered.push(key);
            return refuse ? 0 : 10;
          },
        },
      },
    },
  );
  const ext = new Extension();
  ext._log = () => {};
  ext._settings = { get_strv: () => [] };
  ext._suspendConflictingShortcuts = () => {};
  ext._installKeybindings();
  assert.deepEqual([...registered].sort(), [...keys].sort());
  refuse = true;
  assert.throws(() => ext._installKeybindings(), /Could not register/);
});
