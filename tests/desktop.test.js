import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsTransaction } from '../src/settingsTransaction.js';
import { loadRuntime } from './helpers.js';

function desktopFixture() {
  const records = new Map();
  const writes = [];
  function record(schema, key, value) {
    records.set(`${schema}/${key}`, { value, user: null });
  }
  const wm = 'org.gnome.desktop.wm.preferences';
  record(wm, 'num-workspaces', 4);
  record(
    wm,
    'workspace-names',
    Array.from({ length: 20 }, (_, index) => `original ${index}`),
  );
  record('org.gnome.mutter', 'dynamic-workspaces', true);
  for (const name of ['window', 'app'])
    record(`org.gnome.shell.${name}-switcher`, 'current-workspace-only', false);
  const schemas = new Set([...records.keys()].map((id) => id.slice(0, id.lastIndexOf('/'))));
  const schemaSource = {
    lookup: (name) =>
      schemas.has(name) ? { name, has_key: (key) => records.has(`${name}/${key}`) } : null,
  };
  const variant = (value) => ({ deep_unpack: () => value });
  class Settings {
    constructor({ settings_schema: schema, schema_id }) {
      this.schema = schema?.name ?? schema_id;
    }
    get_strv(key) {
      return records.get(`${this.schema}/${key}`).value;
    }
    get_value(key) {
      return variant(records.get(`${this.schema}/${key}`).value);
    }
    get_user_value(key) {
      const v = records.get(`${this.schema}/${key}`).user;
      return v === null ? null : variant(v);
    }
    set_boolean(key, value) {
      return this.write(key, value);
    }
    set_int(key, value) {
      return this.write(key, value);
    }
    set_strv(key, value) {
      return this.write(key, value);
    }
    write(key, value) {
      const id = `${this.schema}/${key}`;
      writes.push(id);
      const entry = records.get(id);
      entry.value = value;
      entry.user = value;
      return true;
    }
    is_writable() {
      return true;
    }
    reset(key) {
      const entry = records.get(`${this.schema}/${key}`);
      entry.user = null;
    }
    static sync() {}
  }
  const { EnvironmentsSwitcherExtension: Extension } = loadRuntime(
    'extension.js',
    ['EnvironmentsSwitcherExtension'],
    {
      Gio: { Settings, SettingsSchemaSource: { get_default: () => schemaSource } },
      SettingsTransaction,
    },
  );
  const ext = new Extension();
  let backup = '{}';
  const labels = { personal: 'Personal', work: 'Work' };
  ext._settings = {
    get_string: (key) => (key.startsWith('environment-name-') ? labels[key.slice(17)] : backup),
    set_string: (_key, value) => {
      backup = value;
      return true;
    },
  };
  ext._workspaceCount = () => 20;
  return { ext, records, writes, wm, labels, backup: () => JSON.parse(backup) };
}

test('configure count before disabling dynamic mode; preserve extra names without optional schema', () => {
  const { ext, records, writes, wm } = desktopFixture();
  ext._configureDesktop();
  assert.equal(writes[0], `${wm}/num-workspaces`);
  assert.equal(writes[1], 'org.gnome.mutter/dynamic-workspaces');
  assert.equal(records.get(`${wm}/num-workspaces`).value, 20);
  const names = records.get(`${wm}/workspace-names`).value;
  assert.equal(names.length, 20);
  assert.equal(names[18], 'original 18');
  assert.match(names[0], /Personal 1/);
  assert.match(names[9], /Work 1/);
});

test('desktop settings restore explicit user values without overwriting later edits', () => {
  const { ext, records, wm } = desktopFixture();
  const count = records.get(`${wm}/num-workspaces`);
  count.user = 4;
  ext._configureDesktop();
  records.get('org.gnome.shell.app-switcher/current-workspace-only').value = false;
  records.get('org.gnome.shell.app-switcher/current-workspace-only').user = false;
  ext._desktopTransaction.restore();
  assert.equal(count.value, 4);
  assert.equal(records.get('org.gnome.shell.app-switcher/current-workspace-only').user, false);
});

test('unsupported workspace count fails before changing desktop settings', () => {
  const { ext, writes } = desktopFixture();
  ext._workspacesPerContext = 19;
  assert.throws(() => ext._configureDesktop(), /Invalid setting/);
  assert.equal(writes.length, 0);
});

test('live renames refresh every surface, preserve extra names and retain the original backup', () => {
  const { ext, records, wm, labels, backup } = desktopFixture();
  const id = `${wm}/workspace-names`;
  records.get(id).user = [...records.get(id).value];
  const original = [...records.get(id).value];
  ext._configureDesktop();
  const surfaces = [];
  ext._updateIndicator = () => surfaces.push('panel');
  ext._picker = { refreshNames: () => surfaces.push('picker') };
  ext._miniPicker = { refreshNames: () => surfaces.push('preview') };
  for (const name of ['Home', 'Private']) {
    labels.personal = name;
    ext._updateEnvironmentNames();
    assert.equal(records.get(id).value[0], `${name} 1 (1/9)`);
    assert.deepEqual(backup()[id].user, original);
    assert.equal(records.get(id).value[18], original[18]);
  }
  assert.deepEqual(surfaces, ['panel', 'picker', 'preview', 'panel', 'picker', 'preview']);
  ext._desktopTransaction.restore();
  assert.deepEqual(records.get(id).value, original);
});

test('repeated renames never reclaim native names after a manual edit', () => {
  const { ext, records, wm, labels } = desktopFixture();
  ext._configureDesktop();
  const entry = records.get(`${wm}/workspace-names`);
  entry.value = ['Manual'];
  entry.user = ['Manual'];
  for (const name of ['Home', 'Private', 'Life']) {
    labels.personal = name;
    ext._updateEnvironmentNames();
    assert.deepEqual(entry.value, ['Manual']);
  }
  ext._desktopTransaction.restore();
  assert.deepEqual(entry.value, ['Manual']);
});
