// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import { PreferencesDiagnostics } from './preferencesDiagnostics.js';
import * as Config from 'resource:///org/gnome/Shell/Extensions/js/misc/config.js';
import {
  applySettings,
  exportSettings,
  parseSettings,
  MAX_SETTINGS_FILE_BYTES,
} from './settingsTransfer.js';
import {
  AUTHOR,
  FEEDBACK_EMAIL,
  displayVersion,
  issueUrl,
  productivityMessage,
} from './projectInfo.js';

function action(group, title, subtitle, label, callback) {
  const row = new Adw.ActionRow({ title, subtitle, use_markup: false });
  const button = new Gtk.Button({ label, valign: Gtk.Align.CENTER });
  button.connect('clicked', callback);
  row.add_suffix(button);
  row.activatable_widget = button;
  group.add(row);
  return button;
}

function fileOperation(file, operation, finish, args) {
  return new Promise((resolve, reject) => {
    file[operation](...args, (source, result) => {
      try {
        resolve(source[finish](result));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export class PreferencesExtras {
  constructor(preferences, window, canonicalize) {
    this._preferences = preferences;
    this._window = window;
    this._canonicalize = canonicalize;
    this._cancellable = new Gio.Cancellable();
    this._closed = false;
    this._busy = false;
    this._buttons = [];
    const metadata = preferences.metadata;
    const version = displayVersion(metadata);
    const details = {
      extensionVersion: version,
      gnomeVersion: Config.PACKAGE_VERSION,
      osVersion: GLib.get_os_info('PRETTY_NAME') ?? 'Unknown',
    };
    const page = new Adw.PreferencesPage({ title: 'More', icon_name: 'help-about-symbolic' });
    window.add(page);
    const inspiration = new Adw.PreferencesGroup({ title: 'A little encouragement' });
    const message = new Gtk.Label({
      label: `“${productivityMessage()}”`,
      wrap: true,
      xalign: 0,
      margin_top: 12,
      margin_bottom: 12,
      margin_start: 12,
      margin_end: 12,
    });
    message.add_css_class('title-4');
    inspiration.add(message);
    inspiration.add(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));
    page.add(inspiration);
    const transfer = new Adw.PreferencesGroup({
      title: 'Settings files',
      description:
        'Save or restore environment names, shortcuts, and picker timeouts. Import replaces these preferences; session state and desktop restoration data are kept.',
    });
    page.add(transfer);
    this._buttons.push(
      action(
        transfer,
        'Export settings',
        'Save your configuration as a JSON file.',
        'Export…',
        () => this._chooseFile('export'),
      ),
    );
    this._buttons.push(
      action(
        transfer,
        'Import settings',
        'Restore the preferences saved in an exported JSON file.',
        'Import…',
        () => this._chooseFile('import'),
      ),
    );
    this._status = new Gtk.Label({
      label: '',
      wrap: true,
      xalign: 0,
      visible: false,
      margin_top: 8,
      margin_bottom: 8,
      margin_start: 12,
      margin_end: 12,
    });
    transfer.add(this._status);

    this._diagnostics = new PreferencesDiagnostics(preferences.getSettings(), page, window);

    const project = new Adw.PreferencesGroup({ title: 'About Environments Switcher' });
    page.add(project);
    project.add(new Adw.ActionRow({ title: 'Version', subtitle: version, use_markup: false }));
    action(
      project,
      'Project on GitHub',
      'Enjoying the extension? Give it a star to help others find it.',
      'Visit & star',
      () => this._open(metadata.url),
    );
    action(
      project,
      'Report a bug',
      'Opens a GitHub draft with extension, GNOME, and OS versions.',
      'Report…',
      () => this._open(issueUrl(metadata.url, 'bug', details)),
    );
    action(
      project,
      'Suggest a feature',
      'Share an idea for a better workspace workflow on GitHub.',
      'Suggest…',
      () => this._open(issueUrl(metadata.url, 'feature', details)),
    );
    action(project, 'Author', `${AUTHOR} · ${FEEDBACK_EMAIL}`, 'Email', () =>
      this._open(`mailto:${FEEDBACK_EMAIL}`),
    );
    action(project, 'License', 'MIT — free and open source.', 'Read license', () =>
      this._open(`${metadata.url}/blob/main/LICENSE`),
    );
  }

  _message(text, error = false) {
    if (this._closed) return;
    this._status.label = text;
    this._status.visible = true;
    if (error) this._status.add_css_class('error');
    else this._status.remove_css_class('error');
  }

  _cancelled(error) {
    return (
      this._closed ||
      error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED) ||
      error.matches?.(Gtk.dialog_error_quark(), Gtk.DialogError.DISMISSED) ||
      error.matches?.(Gtk.dialog_error_quark(), Gtk.DialogError.CANCELLED)
    );
  }

  _open(uri) {
    const launcher = new Gtk.UriLauncher({ uri });
    launcher.launch(this._window, this._cancellable, (source, result) => {
      try {
        source.launch_finish(result);
      } catch (error) {
        if (!this._cancelled(error)) this._message(`Could not open link: ${error.message}`, true);
      }
    });
  }

  async _chooseFile(mode) {
    if (this._busy || this._closed) return;
    this._busy = true;
    this._buttons.forEach((button) => {
      button.sensitive = false;
    });
    try {
      const dialog = new Gtk.FileDialog({
        title: mode === 'export' ? 'Export settings' : 'Import settings',
        modal: true,
      });
      const filter = new Gtk.FileFilter({ name: 'JSON settings (*.json)' });
      filter.add_pattern('*.json');
      const filters = new Gio.ListStore({ item_type: Gtk.FileFilter });
      filters.append(filter);
      dialog.set_filters(filters);
      dialog.set_default_filter(filter);
      const method = mode === 'export' ? 'save' : 'open';
      if (mode === 'export') dialog.set_initial_name('environments-switcher-settings.json');
      const file = await fileOperation(dialog, method, `${method}_finish`, [
        this._window,
        this._cancellable,
      ]);
      if (this._closed) return;
      if (mode === 'export') await this._exportFile(file);
      else await this._importFile(file);
    } catch (error) {
      if (!this._cancelled(error)) this._message(error.message, true);
    } finally {
      this._busy = false;
      if (!this._closed)
        this._buttons.forEach((button) => {
          button.sensitive = true;
        });
    }
  }

  async _exportFile(file) {
    const text = exportSettings(this._preferences.getSettings(), this._preferences.metadata);
    const bytes = new TextEncoder().encode(text);
    await fileOperation(file, 'replace_contents_bytes_async', 'replace_contents_finish', [
      new GLib.Bytes(bytes),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      this._cancellable,
    ]);
    this._message('Settings exported.');
  }

  async _importFile(file) {
    // Bound reads even for a file that grows while being imported.
    const stream = await fileOperation(file, 'read_async', 'read_finish', [
      GLib.PRIORITY_DEFAULT,
      this._cancellable,
    ]);
    let chunks = [],
      total = 0;
    try {
      while (true) {
        const bytes = await fileOperation(stream, 'read_bytes_async', 'read_bytes_finish', [
          Math.min(65536, MAX_SETTINGS_FILE_BYTES + 1 - total),
          GLib.PRIORITY_DEFAULT,
          this._cancellable,
        ]);
        const data = bytes.get_data();
        if (!data.length) break;
        total += data.length;
        if (total > MAX_SETTINGS_FILE_BYTES)
          throw new Error('Settings file is too large (maximum 1 MiB).');
        chunks.push(data);
      }
    } finally {
      await fileOperation(stream, 'close_async', 'close_finish', [GLib.PRIORITY_DEFAULT, null]);
    }
    if (this._closed) return;
    const contents = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      contents.set(chunk, offset);
      offset += chunk.length;
    }
    const values = parseSettings(
      new TextDecoder('utf-8', { fatal: true }).decode(contents),
      this._preferences.metadata.uuid,
      this._canonicalize,
    );
    applySettings(
      this._preferences.getSettings(),
      values,
      (type, value) => new GLib.Variant(type, value),
    );
    this._message('Settings imported. Names and shortcuts apply immediately.');
  }

  destroy() {
    this._diagnostics.destroy();
    this._closed = true;
    this._cancellable.cancel();
  }
}
