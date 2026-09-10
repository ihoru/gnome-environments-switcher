// SPDX-License-Identifier: MIT

import { DiagnosticLog } from './diagnosticLog.js';

import { DirectionalAnimation } from './directionalAnimation.js';
import { SettingsTransaction } from './settingsTransaction.js';

import { MiniPicker } from './miniPicker.js';
import { WorkspacePicker } from './workspacePicker.js';
import { ThumbnailsBox } from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const CONTEXT_PERSONAL = 'personal';
const CONTEXT_WORK = 'work';
const CONTEXTS = [CONTEXT_PERSONAL, CONTEXT_WORK];
const DEFAULT_WORKSPACES_PER_CONTEXT = 9;
const MIN_WORKSPACES_PER_CONTEXT = 1;

const KEY_ACTIVE_CONTEXT = 'active-context';
const KEY_WORKSPACES_PER_CONTEXT = 'workspaces-per-context';
const KEY_LAST_WORKSPACE_PERSONAL = 'last-workspace-personal';
const KEY_LAST_WORKSPACE_WORK = 'last-workspace-work';
const KEY_CONTEXT_ORDER = 'context-order';
const KEY_WINDOW_CONTEXT_MAP = 'window-context-map';
const KEY_INITIALIZED = 'initialized';

const KEY_TOGGLE_CONTEXT = 'toggle-context';
const KEY_SWITCH_PREFIX = 'switch-workspace-';
const KEY_MOVE_PREFIX = 'move-workspace-';
const WORKSPACE_KEYBINDS = [
  ['7', 0],
  ['8', 1, false],
  ['9', 2, false],
  ['4', 3, false],
  ['5', 4, false],
  ['6', 5, false],
  ['1', 6, false],
  ['2', 7, false],
  ['3', 8, false],
];

const MOVE_WORKSPACE_KEYBINDS = [
  ['7', 0],
  ['8', 1],
  ['9', 2],
  ['4', 3],
  ['5', 4],
  ['6', 5],
  ['1', 6],
  ['2', 7],
  ['3', 8],
];

const SWITCHER_SETTINGS = [
  ['org.gnome.shell.window-switcher', 'current-workspace-only'],
  ['org.gnome.shell.app-switcher', 'current-workspace-only'],
];

const DASH_TO_DOCK_SETTING = ['org.gnome.shell.extensions.dash-to-dock', 'isolate-workspaces'];

function _clampInt(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function _workspaceName(label, index, perContextCount) {
  return `${label} ${index + 1} (${index + 1}/${perContextCount})`;
}

function _contextForValue(value) {
  return value === CONTEXT_WORK ? CONTEXT_WORK : CONTEXT_PERSONAL;
}

function _otherContext(context) {
  return context === CONTEXT_PERSONAL ? CONTEXT_WORK : CONTEXT_PERSONAL;
}

function _workspaceContextFromIndex(index, perContextCount) {
  if (index < perContextCount) {
    return index < 0 ? null : CONTEXT_PERSONAL;
  }
  return index < perContextCount * 2 ? CONTEXT_WORK : null;
}

function _workspaceLogicalFromIndex(index, perContextCount) {
  const mod = Math.abs(index) % (perContextCount * CONTEXTS.length);
  return mod % perContextCount;
}

function _workspacePhysicalFromLogical(context, logical, perContextCount) {
  if (logical < 0 || logical >= perContextCount) {
    return null;
  }
  const base = context === CONTEXT_PERSONAL ? 0 : perContextCount;
  return base + logical;
}

function _ensureNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function _serializeContextMap(map) {
  try {
    return JSON.stringify(map || {});
  } catch (e) {
    return '{}';
  }
}

export default class EnvironmentsSwitcherExtension extends Extension {
  constructor(metadata) {
    super(metadata);

    this._settings = null;
    this._indicator = null;
    this._bindings = [];
    this._workspaceChangedId = 0;
    this._windowCreatedId = 0;
    this._activeContext = CONTEXT_PERSONAL;
    this._workspacesPerContext = DEFAULT_WORKSPACES_PER_CONTEXT;
    this._windowContextMap = {};
  }

  _log(event, details = {}) {
    const enabled = this._settings?.get_boolean('debug-logging');
    const important = /error|failed|missing/.test(event);
    if (!important && !enabled) return;
    const message =
      '[environments-switcher] ' +
      JSON.stringify({
        event,
        context: this._activeContext,
        physicalWorkspace: this._activeWorkspaceIndex() + 1,
        workspaceCount: this._workspaceCount(),
        ...details,
      });
    console.log(message);
    if (enabled) this._diagnosticLog?.write(message);
  }

  _syncDiagnosticLogging() {
    if (this._settings.get_boolean('debug-logging')) {
      if (!this._diagnosticLog) this._diagnosticLog = new DiagnosticLog();
      this._log('diagnostic-logging-enabled');
    } else {
      this._diagnosticLog?.destroy();
      this._diagnosticLog = null;
    }
  }

  _normalizeAccelerator(accelerator) {
    const modifiers = (accelerator.match(/<[^>]+>/g) || [])
      .map((value) => value.toLowerCase().replace(/primary|control/, 'ctrl'))
      .sort();
    return modifiers.join('') + accelerator.replace(/<[^>]+>/g, '').toLowerCase();
  }

  _readShortcutBackup(native) {
    const raw = this._settings.get_string('native-shortcut-backup');
    const backup = JSON.parse(raw);
    if (!backup || typeof backup !== 'object' || Array.isArray(backup))
      throw new Error('Invalid native shortcut backup; preserve it for recovery.');
    const strings = (value) =>
      Array.isArray(value) && value.every((item) => typeof item === 'string');
    for (const [key, entry] of Object.entries(backup)) {
      if (
        !native.settings_schema.has_key(key) ||
        native.settings_schema.get_key(key).get_value_type().dup_string() !== 'as' ||
        !entry ||
        !strings(entry.applied) ||
        !(entry.user === null || strings(entry.user))
      )
        throw new Error(`Invalid native shortcut backup entry: ${key}`);
    }
    return backup;
  }

  _suspendConflictingShortcuts(names) {
    const native = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' });
    const backup = this._readShortcutBackup(native);
    const owned = new Set(
      names
        .flatMap((name) => this._settings.get_strv(name))
        .map((value) => this._normalizeAccelerator(value)),
    );
    for (const key of native.settings_schema.list_keys()) {
      if (this._releasedNativeShortcuts?.has(key)) continue;
      if (native.settings_schema.get_key(key).get_value_type().dup_string() !== 'as') continue;
      const original = native.get_strv(key);
      const applied = original.filter((value) => !owned.has(this._normalizeAccelerator(value)));
      if (applied.length === original.length) continue;
      if (
        Object.hasOwn(backup, key) &&
        JSON.stringify(original) !== JSON.stringify(backup[key].applied)
      ) {
        this._releasedNativeShortcuts?.add(key);
        delete backup[key];
        this._settings.set_string('native-shortcut-backup', JSON.stringify(backup));
        continue;
      }
      if (!Object.hasOwn(backup, key)) {
        backup[key] = {
          original,
          user: native.get_user_value(key)?.deep_unpack() ?? null,
          applied,
        };
      } else {
        backup[key].applied = applied;
      }
      if (!this._settings.set_string('native-shortcut-backup', JSON.stringify(backup)))
        throw new Error('Cannot persist native shortcut restoration state');
      Gio.Settings.sync();
      if (!native.set_strv(key, applied)) throw new Error('Cannot release shortcut: ' + key);
      this._log('shortcut-conflict-suspended', { key, original, applied });
    }
  }

  _restoreConflictingShortcuts() {
    if (!this._settings) return;
    const native = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' });
    const backup = this._readShortcutBackup(native);
    for (const [key, entry] of Object.entries(backup)) {
      if (JSON.stringify(native.get_strv(key)) === JSON.stringify(entry.applied)) {
        if (!native.is_writable(key)) continue;
        if (entry.user === null) native.reset(key);
        else if (!native.set_strv(key, entry.user)) continue;
        this._log('shortcut-restored', { key });
      } else {
        this._releasedNativeShortcuts?.add(key);
        this._log('shortcut-restore-skipped-user-change', { key });
      }
      delete backup[key];
    }
    this._settings.set_string('native-shortcut-backup', JSON.stringify(backup));
  }

  enable() {
    try {
      this._enable();
    } catch (error) {
      this.disable();
      throw error;
    }
  }

  _enable() {
    this._log('enable-start');
    this._settings = this.getSettings();
    this._releasedNativeShortcuts = new Set();
    this._workspaceNamesReleased = false;
    this._syncDiagnosticLogging();

    this._workspacesPerContext = _clampInt(
      this._settings.get_int(KEY_WORKSPACES_PER_CONTEXT),
      MIN_WORKSPACES_PER_CONTEXT,
      99,
    );

    // Window IDs are session-local; infer assignments from current workspaces.
    this._windowContextMap = {};

    this._migrateLegacyState();
    this._initializeDefaults();

    this._activeContext = _contextForValue(this._settings.get_string(KEY_ACTIVE_CONTEXT));

    this._configureDesktop();
    this._ensureWorkspaceCount(this._requiredWorkspaceCount());
    if (this._workspaceCount() < this._requiredWorkspaceCount())
      throw new Error('Cannot create required workspace banks');
    this._createIndicator();
    this._directionalAnimation = new DirectionalAnimation(this);
    this._picker = new WorkspacePicker(this);
    this._miniPicker = new MiniPicker(this);
    this._hideOverviewStrip();
    this._installKeybindings();
    this._installSignals();
    this._watchPreferences();

    this._restoreWindowContexts();
    this._syncToSavedContext();
    this._log('enable-complete');
  }

  disable() {
    const clean = (callback) => {
      try {
        callback();
      } catch (error) {
        console.error(`[environments-switcher] cleanup-error: ${error}`);
      }
    };
    clean(() => this._diagnosticLog?.destroy());
    this._diagnosticLog = null;
    // Disconnect observers before restoring desktop settings/workspace counts.
    if (this._preferencesSignal) clean(() => this._settings.disconnect(this._preferencesSignal));
    this._preferencesSignal = 0;
    if (this._workspaceChangedId)
      clean(() => this._workspaceManager().disconnect(this._workspaceChangedId));
    this._workspaceChangedId = 0;
    if (this._workspaceCountId)
      clean(() => this._workspaceManager().disconnect(this._workspaceCountId));
    this._workspaceCountId = 0;
    if (this._windowCreatedId) clean(() => global.display.disconnect(this._windowCreatedId));
    this._windowCreatedId = 0;

    clean(() => this._directionalAnimation?.destroy());
    this._directionalAnimation = null;
    clean(() => this._miniPicker?.destroy());
    this._miniPicker = null;
    clean(() => this._picker?.destroy());
    this._picker = null;
    // Release children first, including any not yet attached during partial activation.
    clean(() => this._statusLabel?.destroy());
    this._statusLabel = null;
    clean(() => this._toggleItem?.destroy());
    this._toggleItem = null;
    clean(() => this._moveItem?.destroy());
    this._moveItem = null;
    clean(() => this._indicator?.destroy());
    this._indicator = null;
    clean(() => this._restoreOverviewStrip());
    for (const name of this._bindings) clean(() => Main.wm.removeKeybinding(name));
    this._bindings = [];
    clean(() => this._restoreConflictingShortcuts());
    clean(() => {
      if (this._settings) this._saveSettings();
    });
    clean(() => this._desktopTransaction?.restore());
    this._desktopTransaction = null;
    this._settings = null;
    this._windowContextMap = {};
  }

  _environmentName(context) {
    return (
      this._settings?.get_string(`environment-name-${context}`).trim() ||
      (context === CONTEXT_PERSONAL ? 'Personal' : 'Work')
    );
  }

  _watchPreferences() {
    // Keep the complete key set even if a later registration attempt fails.
    this._shortcutKeys = new Set(this._bindings);
    this._preferencesSignal = this._settings.connect('changed', (_settings, key) => {
      try {
        if (key === 'debug-logging') {
          this._syncDiagnosticLogging();
        } else if (key === 'environment-name-personal' || key === 'environment-name-work') {
          this._updateEnvironmentNames();
        } else if (this._shortcutKeys.has(key)) {
          this._refreshKeybindings();
        }
      } catch (error) {
        console.error(`[environments-switcher] preferences-error: ${error}`);
        Main.notifyError('Environments Switcher', `Could not apply preferences: ${error.message}`);
      }
    });
  }

  _refreshKeybindings() {
    for (const name of this._bindings) Main.wm.removeKeybinding(name);
    this._bindings = [];
    this._restoreConflictingShortcuts();
    try {
      this._installKeybindings();
    } catch (error) {
      for (const name of this._bindings) Main.wm.removeKeybinding(name);
      this._bindings = [];
      this._restoreConflictingShortcuts();
      throw error;
    }
  }

  _updateEnvironmentNames() {
    this._updateIndicator();
    this._picker?.refreshNames();
    this._miniPicker?.refreshNames();
    if (this._workspaceNamesReleased || !this._desktopTransaction) return;
    const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
    const names = Array.from({ length: this._requiredWorkspaceCount() }, (_, i) =>
      _workspaceName(
        this._environmentName(_workspaceContextFromIndex(i, this._workspacesPerContext)),
        i % this._workspacesPerContext,
        this._workspacesPerContext,
      ),
    );
    this._workspaceNamesReleased = !this._desktopTransaction.apply(
      'org.gnome.desktop.wm.preferences/workspace-names',
      [...names, ...settings.get_strv('workspace-names').slice(names.length)],
    );
  }

  _configureDesktop() {
    const definitions = [
      [
        'org.gnome.desktop.wm.preferences',
        'num-workspaces',
        'i',
        Math.max(this._workspaceCount(), this._requiredWorkspaceCount()),
      ],
      // Set the fixed count first, so disabling dynamic mode cannot collapse occupied banks.
      ['org.gnome.mutter', 'dynamic-workspaces', 'b', false],
      [
        'org.gnome.desktop.wm.preferences',
        'workspace-names',
        'as',
        Array.from({ length: this._requiredWorkspaceCount() }, (_, i) =>
          _workspaceName(
            this._environmentName(_workspaceContextFromIndex(i, this._workspacesPerContext)),
            i % this._workspacesPerContext,
            this._workspacesPerContext,
          ),
        ),
      ],
      ...SWITCHER_SETTINGS.map(([schema, key]) => [schema, key, 'b', true]),
      [...DASH_TO_DOCK_SETTING, 'b', true],
    ];
    const source = Gio.SettingsSchemaSource.get_default();
    const adapters = {};
    const values = [];
    for (const [schemaId, key, type, value] of definitions) {
      const schema = source.lookup(schemaId, true);
      // Optional integration can disappear between sessions; keep its backup recoverable.
      const available = Boolean(schema?.has_key(key));
      if (!available && schemaId !== DASH_TO_DOCK_SETTING[0])
        throw new Error(`Required desktop schema unavailable: ${schemaId}`);
      const settings = available ? new Gio.Settings({ settings_schema: schema }) : null;
      const id = `${schemaId}/${key}`;
      const get = () => settings.get_value(key).deep_unpack();
      const valid = (candidate) =>
        type === 'b'
          ? typeof candidate === 'boolean'
          : type === 'i'
            ? Number.isInteger(candidate) && candidate >= 1 && candidate <= 36
            : Array.isArray(candidate) && candidate.every((item) => typeof item === 'string');
      adapters[id] = {
        valid,
        available,
        read: get,
        user: () => settings.get_user_value(key)?.deep_unpack() ?? null,
        write: (candidate) => {
          const ok =
            type === 'b'
              ? settings.set_boolean(key, candidate)
              : type === 'i'
                ? settings.set_int(key, candidate)
                : settings.set_strv(key, candidate);
          if (!ok) throw new Error(`Cannot write ${id}`);
        },
        reset: () => {
          if (!settings.is_writable(key)) throw new Error(`Cannot reset ${id}`);
          settings.reset(key);
        },
      };
      if (available) {
        const applied =
          key === 'workspace-names' ? [...value, ...get().slice(value.length)] : value;
        values.push([id, applied]);
      }
    }
    this._desktopTransaction = new SettingsTransaction(
      {
        read: () => this._settings.get_string('desktop-settings-backup'),
        write: (value) => {
          if (!this._settings.set_string('desktop-settings-backup', value))
            throw new Error('Cannot persist desktop restoration state');
          Gio.Settings.sync();
        },
      },
      adapters,
      (error) => console.error(`[environments-switcher] restore-error: ${error}`),
    );
    for (const [id, value] of values) {
      if (!this._desktopTransaction.apply(id, value))
        throw new Error(`Desktop setting changed since last session: ${id}; disable and retry`);
    }
  }

  _initializeDefaults() {
    if (this._settings.get_boolean(KEY_INITIALIZED)) {
      this._settings.set_int(
        KEY_LAST_WORKSPACE_PERSONAL,
        _clampInt(
          this._settings.get_int(KEY_LAST_WORKSPACE_PERSONAL),
          0,
          this._workspacesPerContext - 1,
        ),
      );
      this._settings.set_int(
        KEY_LAST_WORKSPACE_WORK,
        _clampInt(
          this._settings.get_int(KEY_LAST_WORKSPACE_WORK),
          0,
          this._workspacesPerContext - 1,
        ),
      );
      return;
    }

    this._settings.set_string(KEY_CONTEXT_ORDER, 'personal,work');
    this._settings.set_string(KEY_ACTIVE_CONTEXT, CONTEXT_PERSONAL);
    this._settings.set_int(KEY_LAST_WORKSPACE_PERSONAL, 0);
    this._settings.set_int(KEY_LAST_WORKSPACE_WORK, 0);
    this._settings.set_int(KEY_WORKSPACES_PER_CONTEXT, this._workspacesPerContext);
    this._settings.set_boolean(KEY_INITIALIZED, true);
  }

  _migrateLegacyState() {
    const order = this._settings.get_string(KEY_CONTEXT_ORDER);
    if (order !== 'work,personal') {
      return;
    }

    const oldPersonal = this._settings.get_int(KEY_LAST_WORKSPACE_PERSONAL);
    const oldWork = this._settings.get_int(KEY_LAST_WORKSPACE_WORK);
    const oldContext = _contextForValue(this._settings.get_string(KEY_ACTIVE_CONTEXT));

    this._settings.set_int(KEY_LAST_WORKSPACE_PERSONAL, oldWork);
    this._settings.set_int(KEY_LAST_WORKSPACE_WORK, oldPersonal);
    this._settings.set_string(KEY_ACTIVE_CONTEXT, _otherContext(oldContext));

    const swapped = {};
    for (const key in this._windowContextMap) {
      const value = this._windowContextMap[key];
      if (value === CONTEXT_PERSONAL) {
        swapped[key] = CONTEXT_WORK;
      } else if (value === CONTEXT_WORK) {
        swapped[key] = CONTEXT_PERSONAL;
      } else {
        swapped[key] = value;
      }
    }
    this._windowContextMap = swapped;
    this._settings.set_string(KEY_WINDOW_CONTEXT_MAP, _serializeContextMap(this._windowContextMap));
    this._settings.set_string(KEY_CONTEXT_ORDER, 'personal,work');
  }

  _requiredWorkspaceCount() {
    return this._workspacesPerContext * CONTEXTS.length;
  }

  _workspaceManager() {
    return global.workspace_manager;
  }

  _workspaceCount() {
    const manager = this._workspaceManager();
    if (!manager) {
      return 0;
    }
    if (typeof manager.get_n_workspaces === 'function') {
      return manager.get_n_workspaces();
    }
    return _ensureNumber(manager.n_workspaces, 0);
  }

  _getWorkspaceByIndex(index) {
    return this._workspaceManager().get_workspace_by_index(index);
  }

  _appendWorkspace() {
    const manager = this._workspaceManager();
    if (!manager) {
      return false;
    }

    if (typeof manager.append_new_workspace === 'function') {
      manager.append_new_workspace(false, global.get_current_time());
      return true;
    }

    if (typeof manager.create_workspace === 'function') {
      manager.create_workspace(false, global.get_current_time());
      return true;
    }

    return false;
  }

  _ensureWorkspaceCount(count) {
    let current = this._workspaceCount();
    let attempts = 0;
    while (current < count && attempts < count) {
      if (!this._appendWorkspace()) {
        break;
      }
      current = this._workspaceCount();
      attempts++;
    }
  }

  _activeWorkspaceIndex() {
    const workspace = this._workspaceManager().get_active_workspace();
    if (!workspace || typeof workspace.index !== 'function') {
      return -1;
    }
    return workspace.index();
  }

  _activeWorkspaceLogical() {
    const idx = this._activeWorkspaceIndex();
    if (idx < 0) {
      return 0;
    }
    return _workspaceLogicalFromIndex(idx, this._workspacesPerContext);
  }

  _activeWorkspaceContext() {
    const idx = this._activeWorkspaceIndex();
    if (idx < 0) {
      return this._activeContext;
    }
    return _workspaceContextFromIndex(idx, this._workspacesPerContext);
  }

  _syncToSavedContext() {
    const savedContext = this._settings.get_string(KEY_ACTIVE_CONTEXT);
    this._activeContext = _contextForValue(savedContext);
    const last = this._getLastWorkspace(this._activeContext);
    this._activateContextWorkspace(this._activeContext, last);
    this._updateIndicator();
  }

  _getLastWorkspace(context) {
    if (context === CONTEXT_PERSONAL) {
      return _clampInt(
        this._settings.get_int(KEY_LAST_WORKSPACE_PERSONAL),
        0,
        this._workspacesPerContext - 1,
      );
    }
    return _clampInt(
      this._settings.get_int(KEY_LAST_WORKSPACE_WORK),
      0,
      this._workspacesPerContext - 1,
    );
  }

  _setLastWorkspace(context, logical) {
    const clamped = _clampInt(logical, 0, this._workspacesPerContext - 1);
    if (context === CONTEXT_PERSONAL) {
      this._settings.set_int(KEY_LAST_WORKSPACE_PERSONAL, clamped);
    } else {
      this._settings.set_int(KEY_LAST_WORKSPACE_WORK, clamped);
    }
  }

  _saveSettings() {
    this._settings.set_string(KEY_ACTIVE_CONTEXT, this._activeContext);
    this._settings.set_string(KEY_WINDOW_CONTEXT_MAP, _serializeContextMap(this._windowContextMap));
  }

  _createIndicator() {
    this._indicator = new PanelMenu.Button(0.0, 'Environment Switcher');
    const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
    this._statusLabel = new St.Label({ text: '', y_align: Clutter.ActorAlign.CENTER });
    box.add_child(this._statusLabel);
    this._indicator.add_child(box);

    const toggleItem = new PopupMenu.PopupMenuItem('Switch environment');
    toggleItem.connect('activate', () => this._toggleContext());
    this._toggleItem = toggleItem;

    const moveItem = new PopupMenu.PopupMenuItem('Move focused window to other environment');
    moveItem.connect('activate', () => this._moveFocusedWindowToOtherContext());
    this._moveItem = moveItem;

    this._indicator.menu.addMenuItem(toggleItem);
    this._indicator.menu.addMenuItem(moveItem);
    Main.panel.addToStatusArea('environments-switcher', this._indicator, 0, 'right');

    this._updateIndicator();
  }

  _forEachOverviewStrip(callback) {
    const visit = (actor) => {
      if (actor instanceof ThumbnailsBox) callback(actor);
      for (const child of actor.get_children()) visit(child);
    };
    visit(global.stage);
  }

  _hideOverviewStrip() {
    const prototype = ThumbnailsBox.prototype;
    this._originalStripUpdate = prototype._updateShouldShow;
    this._stripUpdate = function () {
      if (this._shouldShow !== false) {
        this._shouldShow = false;
        this.notify('should-show');
      }
      this.remove_transition('expand-fraction');
      this.expand_fraction = 0;
      this.hide();
    };
    // Secondary monitor strips are recreated on overview entry and hotplug.
    // Their constructors call this shared method, so new strips are covered too.
    prototype._updateShouldShow = this._stripUpdate;
    this._forEachOverviewStrip((strip) => strip._updateShouldShow());
    this._log('overview-strips-hidden', { scope: 'all-monitors' });
  }

  _restoreOverviewStrip() {
    const prototype = ThumbnailsBox.prototype;
    if (this._stripUpdate && prototype._updateShouldShow === this._stripUpdate) {
      prototype._updateShouldShow = this._originalStripUpdate;
      this._forEachOverviewStrip((strip) => strip._updateShouldShow());
    }
    this._originalStripUpdate = null;
    this._stripUpdate = null;
  }

  _installSignals() {
    this._workspaceCountId = this._workspaceManager().connect('notify::n-workspaces', () =>
      this._log('workspace-count-changed'),
    );
    this._workspaceChangedId = this._workspaceManager().connect(
      'active-workspace-changed',
      this._onActiveWorkspaceChanged.bind(this),
    );
    this._windowCreatedId = global.display.connect(
      'window-created',
      this._onWindowCreated.bind(this),
    );
  }

  _installKeybindings() {
    const handlers = [
      [KEY_TOGGLE_CONTEXT, this._toggleContext.bind(this)],
      ['move-other-environment', () => this._moveFocusedWindowToOtherContext()],
      ['environment-picker', () => this._picker.toggle()],
      ['environment-previous', () => this._stepLogicalWorkspace(-1)],
      ['environment-next', () => this._stepLogicalWorkspace(1)],
      ['environment-up', () => this._stepLogicalWorkspace(-3)],
      ['environment-down', () => this._stepLogicalWorkspace(3)],
      ['environment-move-left', () => this._moveFocusedWindowByDirection(-1)],
      ['environment-move-right', () => this._moveFocusedWindowByDirection(1)],
      ['environment-move-up', () => this._moveFocusedWindowByDirection(-3)],
      ['environment-move-down', () => this._moveFocusedWindowByDirection(3)],
    ];

    WORKSPACE_KEYBINDS.forEach(([num, logical]) => {
      handlers.push([
        `${KEY_SWITCH_PREFIX}${num}`,
        this._activateLogicalWorkspace.bind(this, logical),
      ]);
    });

    MOVE_WORKSPACE_KEYBINDS.forEach(([num, logical]) => {
      handlers.push([
        `${KEY_MOVE_PREFIX}${num}`,
        this._moveFocusedWindowToLogicalWorkspace.bind(this, logical),
      ]);
    });

    this._suspendConflictingShortcuts(handlers.map(([name]) => name));
    for (const [name, callback] of handlers) {
      const action = Main.wm.addKeybinding(
        name,
        this._settings,
        Meta.KeyBindingFlags.NONE,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
        (...args) => {
          this._log('shortcut-invoked', { name });
          try {
            if (name === 'environment-picker') this._miniPicker.hide();
            callback(...args);
            if (name !== 'environment-picker') {
              this._miniPicker.show(this._activeWorkspaceContext(), this._activeWorkspaceLogical());
            }
          } catch (error) {
            this._log('shortcut-error', { name, error: String(error), stack: error.stack });
            throw error;
          }
        },
      );
      if (action === Meta.KeyBindingAction.NONE)
        throw new Error(`Could not register shortcut action: ${name}`);
      this._log('shortcut-registered', {
        name,
        action,
        accelerators: this._settings.get_strv(name),
      });
      this._bindings.push(name);
    }
  }

  _onActiveWorkspaceChanged() {
    const currentContext = this._activeWorkspaceContext();
    const currentLogical = this._activeWorkspaceLogical();
    if (!CONTEXTS.includes(currentContext)) {
      return;
    }

    this._log('workspace-changed', {
      nextContext: currentContext,
      logicalWorkspace: currentLogical + 1,
    });
    this._activeContext = currentContext;
    this._setLastWorkspace(currentContext, currentLogical);
    this._saveSettings();
    this._updateIndicator();
  }

  _onWindowCreated(_display, window) {
    if (!window || typeof window.get_id !== 'function') {
      return;
    }
    const workspace = window.get_workspace?.();
    if (!workspace || typeof workspace.index !== 'function') {
      return;
    }

    const id = window.get_id().toString();
    if (id in this._windowContextMap) {
      return;
    }

    const inferred = _workspaceContextFromIndex(workspace.index(), this._workspacesPerContext);
    this._windowContextMap[id] = inferred;
    this._settings.set_string(KEY_WINDOW_CONTEXT_MAP, _serializeContextMap(this._windowContextMap));
  }

  _restoreWindowContexts() {
    const windows = global.get_window_actors?.() ?? [];
    for (const actor of windows) {
      if (!actor || !actor.meta_window) {
        continue;
      }

      const window = actor.meta_window;
      const id = window.get_id?.() ? window.get_id().toString() : null;
      if (!id) {
        continue;
      }

      const workspace = window.get_workspace?.();
      if (!workspace || typeof workspace.index !== 'function') {
        continue;
      }

      if (!(id in this._windowContextMap)) {
        const inferred = _workspaceContextFromIndex(workspace.index(), this._workspacesPerContext);
        this._windowContextMap[id] = inferred;
      }
    }
    this._settings.set_string(KEY_WINDOW_CONTEXT_MAP, _serializeContextMap(this._windowContextMap));
  }

  _windowContext(window) {
    if (!window || typeof window.get_id !== 'function') {
      return this._activeContext;
    }

    const workspace = window.get_workspace?.();
    if (!workspace || typeof workspace.index !== 'function') {
      return this._activeContext;
    }
    return _workspaceContextFromIndex(workspace.index(), this._workspacesPerContext);
  }

  _setWindowContext(window, context) {
    if (!window || typeof window.get_id !== 'function') {
      return;
    }
    const id = window.get_id().toString();
    this._windowContextMap[id] = _contextForValue(context);
    this._settings.set_string(KEY_WINDOW_CONTEXT_MAP, _serializeContextMap(this._windowContextMap));
  }

  _moveFocusedWindowByDirection(delta) {
    const window = global.display.get_focus_window();
    const workspace = window?.get_workspace();
    if (!workspace || window.is_on_all_workspaces()) {
      this._log('window-direction-skipped', { reason: 'no-workspace-or-sticky', delta });
      return;
    }
    const count = this._workspacesPerContext;
    const source = workspace.index();
    if (source < 0 || source >= count * 2) return;
    const context = source < count ? CONTEXT_PERSONAL : CONTEXT_WORK;
    const logical = ((((source % count) + delta) % count) + count) % count;
    const physical = (context === CONTEXT_WORK ? count : 0) + logical;
    if (physical === source) return;
    this._moveWindowToContextAndLogical(window, context, logical);
    if (window.get_workspace()?.index() !== physical) {
      this._log('window-direction-failed', { targetPhysicalWorkspace: physical + 1 });
      return;
    }
    const vector =
      Math.abs(delta) === 3 ? { dx: 0, dy: Math.sign(delta) } : { dx: Math.sign(delta), dy: 0 };
    this._activateContextWorkspace(context, logical, vector);
    window.activate(global.get_current_time());
    this._log('window-direction-moved', {
      delta,
      targetContext: context,
      logicalWorkspace: logical + 1,
    });
  }

  _stepLogicalWorkspace(delta) {
    const logical =
      (((this._activeWorkspaceLogical() + delta) % this._workspacesPerContext) +
        this._workspacesPerContext) %
      this._workspacesPerContext;
    this._log('direction-request', { delta, logicalWorkspace: logical + 1 });
    const vector =
      Math.abs(delta) === 3 ? { dx: 0, dy: Math.sign(delta) } : { dx: Math.sign(delta), dy: 0 };
    this._activateContextWorkspace(this._activeContext, logical, vector);
  }

  _activateLogicalWorkspace(logical) {
    this._activateContextWorkspace(this._activeContext, logical);
  }

  _moveFocusedWindowToLogicalWorkspace(logical) {
    const window = global.display.get_focus_window?.();
    if (!window || window.is_on_all_workspaces()) {
      return;
    }
    const context = this._activeContext;
    const target = _clampInt(logical, 0, this._workspacesPerContext - 1);
    const physical = _workspacePhysicalFromLogical(context, target, this._workspacesPerContext);
    this._moveWindowToContextAndLogical(window, context, target);
    if (window.get_workspace()?.index() !== physical) {
      this._log('window-numpad-move-failed', { targetPhysicalWorkspace: physical + 1 });
      return;
    }
    this._activateContextWorkspace(context, target);
    window.activate(global.get_current_time());
    this._log('window-numpad-followed', { targetContext: context, logicalWorkspace: target + 1 });
  }

  _activateContextWorkspace(context, logical, vector = null) {
    const clamped = _clampInt(logical, 0, this._workspacesPerContext - 1);
    const physical = _workspacePhysicalFromLogical(context, clamped, this._workspacesPerContext);
    if (physical == null) {
      return;
    }

    this._log('workspace-request', {
      targetContext: context,
      logicalWorkspace: clamped + 1,
      targetPhysicalWorkspace: physical + 1,
    });
    const workspace = this._getWorkspaceByIndex(physical);
    if (!workspace || typeof workspace.activate !== 'function') {
      this._log('workspace-missing', { targetPhysicalWorkspace: physical + 1 });
      return;
    }

    this._directionalAnimation.activate(workspace, vector, this._workspacesPerContext);
    this._setLastWorkspace(context, clamped);
    this._activeContext = context;
    this._saveSettings();
    this._updateIndicator();
  }

  _moveWindowToContextAndLogical(window, context, logical) {
    const clamped = _clampInt(logical, 0, this._workspacesPerContext - 1);
    const physical = _workspacePhysicalFromLogical(context, clamped, this._workspacesPerContext);
    if (physical == null) {
      return;
    }

    this._log('window-move-request', {
      windowId: window.get_id?.(),
      targetContext: context,
      targetPhysicalWorkspace: physical + 1,
    });
    const targetWorkspace = this._getWorkspaceByIndex(physical);
    if (!targetWorkspace) {
      return;
    }

    if (typeof window.change_workspace === 'function') {
      window.change_workspace(targetWorkspace);
      if (window.get_workspace()?.index() !== physical) return;
      this._setWindowContext(window, context);
      this._setLastWorkspace(context, clamped);
      this._updateIndicator();
      return;
    }

    if (typeof window.change_workspace_by_index === 'function') {
      window.change_workspace_by_index(physical);
      if (window.get_workspace()?.index() !== physical) return;
      this._setWindowContext(window, context);
      this._setLastWorkspace(context, clamped);
      this._updateIndicator();
      return;
    }
  }

  _toggleContext() {
    const next = this._activeContext === CONTEXT_PERSONAL ? CONTEXT_WORK : CONTEXT_PERSONAL;
    const nextLast = this._getLastWorkspace(next);
    this._activateContextWorkspace(next, nextLast);
    this._settings.set_string(KEY_ACTIVE_CONTEXT, this._activeContext);
  }

  _moveFocusedWindowToOtherContext() {
    const window = global.display.get_focus_window?.();
    if (!window || window.is_on_all_workspaces()) {
      return;
    }

    const current = this._windowContext(window);
    const target = _otherContext(current);
    const workspace = window.get_workspace?.();
    const logical =
      workspace && typeof workspace.index === 'function'
        ? _workspaceLogicalFromIndex(workspace.index(), this._workspacesPerContext)
        : this._getLastWorkspace(target);

    this._moveWindowToContextAndLogical(window, target, logical);
    const physical = _workspacePhysicalFromLogical(target, logical, this._workspacesPerContext);
    if (window.get_workspace()?.index() !== physical) {
      this._log('window-environment-move-failed', {
        targetContext: target,
        logicalWorkspace: logical + 1,
      });
      return;
    }
    this._activateContextWorkspace(target, logical);
    window.activate(global.get_current_time());
    this._log('window-environment-followed', {
      targetContext: target,
      logicalWorkspace: logical + 1,
    });
  }

  _updateIndicator() {
    if (!this._indicator) {
      return;
    }

    const logical = this._getLastWorkspace(this._activeContext);
    const contextName = this._environmentName(this._activeContext);
    const targetName = this._environmentName(_otherContext(this._activeContext));

    this._statusLabel.text = `${contextName}: ${logical + 1} / ${this._workspacesPerContext}`;
    this._toggleItem.label.text = `Switch to ${targetName}`;
    this._moveItem.label.text = `Move focused window to ${targetName}`;
  }
}
