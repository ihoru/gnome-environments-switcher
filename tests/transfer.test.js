import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTABLE_SETTINGS,
  exportSettings,
  parseSettings,
  applySettings,
} from '../src/settingsTransfer.js';
import { displayVersion, issueUrl, AUTHOR, FEEDBACK_EMAIL } from '../src/projectInfo.js';
import { loadRuntime } from './helpers.js';

const metadata = { uuid: 'test-extension', 'version-name': '0.1.0' };
const canonicalize = (value) => (value === 'invalid' ? null : value.replace('Primary', 'Ctrl'));
function fixture() {
  const values = Object.fromEntries(
    Object.entries(PORTABLE_SETTINGS).map(([key, type]) => [
      key,
      type === 's'
        ? key.endsWith('work')
          ? 'Work'
          : 'Personal'
        : type === 'as'
          ? []
          : type === 'b'
            ? false
            : 9,
    ]),
  );
  values['environment-picker'] = ['<Super>w'];
  values['move-other-environment'] = ['<Ctrl>KP_0', '<Ctrl>KP_Insert'];
  values['workspaces-per-context'] = 9;
  values['debug-logging'] = false;
  values['desktop-settings-backup'] = 'private restoration state';
  const calls = [];
  let pending = {};
  const settings = {
    get_value: (key) => ({ deep_unpack: () => values[key] }),
    is_writable: () => true,
    delay: () => calls.push('delay'),
    set_value: (key, value) => {
      pending[key] = value;
      calls.push(key);
      return true;
    },
    apply: () => {
      Object.assign(values, pending);
      pending = {};
      calls.push('apply');
    },
    revert: () => {
      pending = {};
      calls.push('revert');
    },
  };
  return { values, settings, calls, file: () => exportSettings(settings, metadata) };
}
const variant = (_type, value) => value;

test('settings export/import round-trips all portable values, alternatives, Unicode and disabled bindings', () => {
  const f = fixture();
  f.values['environment-name-personal'] = 'Дом & отдых';
  f.values['debug-logging'] = true;
  const text = f.file();
  const parsed = parseSettings(text, metadata.uuid, canonicalize);
  for (const key of Object.keys(PORTABLE_SETTINGS)) assert.deepEqual(parsed[key], f.values[key]);
  assert.ok(!text.includes('desktop-settings-backup'));
  assert.ok(!text.includes('private restoration state'));
  const target = fixture();
  applySettings(target.settings, parsed, variant);
  assert.equal(target.values['workspaces-per-context'], 9);
  assert.ok(!text.includes('workspaces-per-context'));
  assert.ok(!text.includes('debug-logging'));
  assert.equal(target.values['debug-logging'], false);
  assert.equal(target.values['environment-name-personal'], 'Дом & отдых');
  assert.equal(target.values['desktop-settings-backup'], 'private restoration state');
});

test('import rejects corrupt, foreign, incomplete, internal and invalid configurations', () => {
  const f = fixture();
  const cases = [
    (data) => {
      data.formatVersion = 2;
    },
    (data) => {
      data.extensionUuid = 'other';
    },
    (data) => {
      delete data.settings['environment-picker'];
    },
    (data) => {
      data.settings['native-shortcut-backup'] = '{}';
    },
    (data) => {
      data.settings['environment-name-work'] = ' ';
    },
    (data) => {
      data.settings['environment-name-work'] = 1;
    },
    (data) => {
      data.settings['debug-logging'] = 'true';
    },
    (data) => {
      data.settings['environment-picker'] = 'bad';
    },
    (data) => {
      data.settings['environment-picker'] = [123];
    },
    (data) => {
      data.settings['environment-picker'] = ['invalid'];
    },
    (data) => {
      data.settings['environment-picker'] = ['<Ctrl>a', '<Primary>a'];
    },
    (data) => {
      data.settings['toggle-context'] = ['<Super>w'];
    },
    ...[0, 9, 19, 1.5, '9'].map((value) => (data) => {
      data.settings['workspaces-per-context'] = value;
    }),
  ];
  for (const mutate of cases) {
    const data = JSON.parse(f.file());
    mutate(data);
    assert.throws(() => parseSettings(JSON.stringify(data), metadata.uuid, canonicalize));
  }
  for (const text of ['bad', 'null', '[]', 'x'.repeat(1024 * 1024 + 1)])
    assert.throws(() => parseSettings(text, metadata.uuid, canonicalize));
  assert.deepEqual(f.calls, []);
});

test('import validates swapped shortcuts against the new configuration and commits them together', () => {
  const f = fixture();
  f.values['toggle-context'] = ['<Ctrl>a'];
  const data = JSON.parse(f.file());
  data.settings['toggle-context'] = ['<Super>w'];
  data.settings['environment-picker'] = ['<Ctrl>a'];
  const parsed = parseSettings(JSON.stringify(data), metadata.uuid, canonicalize);
  applySettings(f.settings, parsed, variant);
  assert.equal(f.calls[0], 'delay');
  assert.equal(f.calls.at(-1), 'apply');
  assert.equal(f.values['workspaces-per-context'], 9);
  assert.deepEqual(f.values['toggle-context'], ['<Super>w']);
});

test('locked settings and failed staged writes do not partially import', () => {
  for (const locked of [true, false]) {
    const f = fixture();
    const parsed = parseSettings(f.file(), metadata.uuid, canonicalize);
    parsed['environment-name-personal'] = 'Home';
    parsed['environment-name-work'] = 'Office';
    if (locked) f.settings.is_writable = (key) => key !== 'environment-name-work';
    else {
      const set = f.settings.set_value;
      f.settings.set_value = (key, value) =>
        key === 'environment-name-work' ? false : set(key, value);
    }
    assert.throws(() => applySettings(f.settings, parsed, variant));
    assert.equal(f.values['environment-name-personal'], 'Personal');
    assert.equal(f.values['environment-name-work'], 'Work');
    assert.ok(!f.calls.includes('apply'));
    assert.equal(locked ? f.calls.length : f.calls.at(-1), locked ? 0 : 'revert');
  }
});

test('saving runtime state preserves an externally configured workspace count', () => {
  const { EnvironmentsSwitcherExtension: Extension } = loadRuntime('extension.js', [
    'EnvironmentsSwitcherExtension',
  ]);
  const ext = new Extension();
  const values = { 'workspaces-per-context': 6 };
  ext._settings = {
    set_string: (key, value) => {
      values[key] = value;
    },
    set_int: (key, value) => {
      values[key] = value;
    },
  };
  ext._workspacesPerContext = 9;
  ext._saveSettings();
  assert.equal(values['workspaces-per-context'], 6);
  assert.equal(values['active-context'], 'personal');
});

test('project links encode all diagnostic versions into matching GitHub form fields', () => {
  const details = {
    extensionVersion: '0.1.0 (build 2)',
    gnomeVersion: '46.2',
    osVersion: 'Example OS 24 & later',
  };
  for (const kind of ['bug', 'feature']) {
    const url = new URL(
      issueUrl('https://github.com/ihoru/gnome-environments-switcher', kind, details),
    );
    assert.equal(url.pathname, '/ihoru/gnome-environments-switcher/issues/new');
    assert.equal(url.searchParams.get('template'), `${kind}.yml`);
    for (const value of Object.values(details))
      assert.ok(url.searchParams.get('environment').includes(value));
  }
  assert.equal(displayVersion({ 'version-name': '0.1.0', version: 2 }), '0.1.0 (build 2)');
  assert.equal(displayVersion({ version: 2 }), '2');
  assert.equal(displayVersion({}), 'Unknown');
  assert.equal(AUTHOR, 'Igor Polyakov');
  assert.equal(FEEDBACK_EMAIL, 'ihor.polyakov@gmail.com');
});

test('approved productivity messages form a ten-message pool with every message selectable', async () => {
  const { PRODUCTIVITY_MESSAGES, productivityMessage } = await import('../src/projectInfo.js');
  assert.equal(PRODUCTIVITY_MESSAGES.length, 10);
  assert.equal(new Set(PRODUCTIVITY_MESSAGES).size, 10);
  for (let index = 0; index < 10; index++)
    assert.equal(
      productivityMessage(() => (index + 0.5) / 10),
      PRODUCTIVITY_MESSAGES[index],
    );
});

test('timeouts transfer with validation; older exports leave current timeout values unchanged', () => {
  const f = fixture();
  const data = JSON.parse(f.file());
  for (const value of [-1, 60001, 0.5, '1500']) {
    data.settings['picker-timeout-ms'] = value;
    assert.throws(
      () => parseSettings(JSON.stringify(data), metadata.uuid, canonicalize),
      /Timeout/,
    );
  }
  data.settings['picker-timeout-ms'] = 2500;
  data.settings['mini-picker-timeout-ms'] = 0;
  applySettings(
    f.settings,
    parseSettings(JSON.stringify(data), metadata.uuid, canonicalize),
    variant,
  );
  assert.equal(f.values['picker-timeout-ms'], 2500);
  assert.equal(f.values['mini-picker-timeout-ms'], 0);
  delete data.settings['picker-timeout-ms'];
  delete data.settings['mini-picker-timeout-ms'];
  applySettings(
    f.settings,
    parseSettings(JSON.stringify(data), metadata.uuid, canonicalize),
    variant,
  );
  assert.equal(f.values['picker-timeout-ms'], 2500);
  assert.equal(f.values['mini-picker-timeout-ms'], 0);
});
