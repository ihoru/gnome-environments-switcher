// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

export class PreferencesDiagnostics {
  constructor(settings, page, window) {
    this._settings = settings;
    this._window = window;
    this._closed = false;
    this._cancellable = new Gio.Cancellable();
    this._directory = GLib.build_filenamev([GLib.get_user_state_dir(), 'environments-switcher']);
    this._file = Gio.File.new_for_path(GLib.build_filenamev([this._directory, 'diagnostics.log']));
    const group = new Adw.PreferencesGroup({
      title: 'Diagnostics',
      description:
        'Enable logging and reproduce the problem. The running extension appends new events to this file automatically, even after preferences is closed.',
    });
    page.add(group);
    const row = new Adw.ActionRow({
      title: 'Enable diagnostic logging',
      subtitle: 'Extra runtime details. Off by default.',
    });
    this._checkbox = new Gtk.CheckButton({ valign: Gtk.Align.CENTER });
    row.add_suffix(this._checkbox);
    row.activatable_widget = this._checkbox;
    settings.bind('debug-logging', this._checkbox, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(row);
    const location = new Gtk.Label({
      label: this._file.get_path(),
      selectable: true,
      wrap: true,
      xalign: 0,
      margin_top: 12,
      margin_bottom: 8,
      margin_start: 12,
      margin_end: 12,
    });
    location.add_css_class('monospace');
    group.add(location);
    const explanation = new Gtk.Label({
      label:
        'Open the file to copy relevant lines into your bug report. Reopen or reload it in your editor to see new entries. The extension must be enabled.',
      wrap: true,
      xalign: 0,
      margin_start: 12,
      margin_end: 12,
    });
    group.add(explanation);
    const controls = new Gtk.Box({
      spacing: 8,
      margin_top: 8,
      margin_bottom: 8,
      margin_start: 12,
      margin_end: 12,
    });
    this._open = new Gtk.Button({
      label: 'Open log file',
    });
    const copy = new Gtk.Button({ label: 'Copy path' });
    this._open.connect('clicked', () => {
      const launcher = new Gtk.FileLauncher({ file: this._file });
      launcher.launch(window, this._cancellable, (source, result) => {
        try {
          source.launch_finish(result);
        } catch (error) {
          if (!this._closed) this._message(error.message, true);
        }
      });
    });
    copy.connect('clicked', () => {
      window.get_clipboard().set(this._file.get_path());
      this._message('Log file path copied.');
    });
    for (const button of [this._open, copy]) controls.append(button);
    group.add(controls);
    this._status = new Gtk.Label({
      label: '',
      visible: false,
      selectable: true,
      wrap: true,
      xalign: 0,
      margin_bottom: 8,
      margin_start: 12,
      margin_end: 12,
    });
    group.add(this._status);
  }

  _message(text, error = false) {
    if (this._closed) return;
    this._status.label = text;
    this._status.visible = true;
    if (error) this._status.add_css_class('error');
    else this._status.remove_css_class('error');
  }

  destroy() {
    this._closed = true;
    this._cancellable.cancel();
    Gio.Settings.unbind(this._checkbox, 'active');
  }
}
