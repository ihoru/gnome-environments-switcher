// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import { PreferencesExtras } from './preferencesExtras.js';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {
  ENVIRONMENTS,
  PICKER_TIMEOUTS,
  SHORTCUT_GROUPS,
  validateName,
  validateShortcuts,
} from './preferencesModel.js';

function canonicalize(value) {
  const [ok, key, modifiers] = Gtk.accelerator_parse(value);
  if (!ok || !Gtk.accelerator_valid(key, modifiers)) return null;
  // Do not claim ordinary typing keys, with or without Shift.
  const meaningful = modifiers & ~Gdk.ModifierType.SHIFT_MASK;
  if (!meaningful && Gdk.keyval_to_unicode(key)) return null;
  return Gtk.accelerator_name(Gdk.keyval_to_lower(key), modifiers);
}

function shortcutLabel(value) {
  const [ok, key, modifiers] = Gtk.accelerator_parse(value);
  return ok ? Gtk.accelerator_get_label(key, modifiers) : value;
}

function button(label, callback) {
  const widget = new Gtk.Button({ label, valign: Gtk.Align.CENTER });
  widget.connect('clicked', callback);
  return widget;
}

function focusPageTab(widget, page) {
  // PreferencesWindow does not expose its adaptive tab switchers directly.
  if (
    widget instanceof Adw.ViewSwitcher &&
    widget.get_mapped() &&
    widget.get_stack()?.get_visible_child() === page &&
    widget.child_focus(Gtk.DirectionType.TAB_FORWARD)
  )
    return true;
  for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
    if (focusPageTab(child, page)) return true;
  return false;
}

export default class EnvironmentsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const signals = [];
    const captureWindows = new Set();
    let extras;
    window.set_default_size(760, 650);
    window.connect('close-request', () => {
      extras?.destroy();
      for (const dialog of captureWindows) dialog.close();
      for (const signal of signals) settings.disconnect(signal);
      signals.length = 0;
      return false;
    });
    const namesPage = new Adw.PreferencesPage({
      title: 'General',
      icon_name: 'view-grid-symbolic',
    });
    window.add(namesPage);
    const names = new Adw.PreferencesGroup({
      title: 'Environment names',
      description: 'Names update immediately when saved. Workspaces and windows stay in place.',
    });
    namesPage.add(names);
    for (const { id, title, fallback } of ENVIRONMENTS) {
      const key = `environment-name-${id}`;
      const entry = new Adw.EntryRow({ title, show_apply_button: true });
      const error = new Gtk.Label({ label: '', wrap: true, xalign: 0, visible: false });
      error.add_css_class('error');
      const refresh = () => {
        entry.text = settings.get_string(key);
      };
      refresh();
      entry.connect('apply', () => {
        try {
          const value = validateName(entry.text);
          if (!settings.set_string(key, value)) throw new Error('Could not save the name.');
          refresh();
          error.visible = false;
          entry.remove_css_class('error');
        } catch (e) {
          error.label = e.message;
          error.visible = true;
          entry.add_css_class('error');
        }
      });
      entry.add_suffix(
        button('Reset', () => {
          if (settings.set_string(key, fallback)) {
            refresh();
            error.visible = false;
            entry.remove_css_class('error');
          }
        }),
      );
      signals.push(settings.connect(`changed::${key}`, refresh));
      names.add(entry);
      names.add(error);
    }

    const timing = new Adw.PreferencesGroup({
      title: 'Picker timing',
      description: 'Milliseconds before hiding after modifier release. Zero closes immediately.',
    });
    namesPage.add(timing);
    const timingRows = [];
    for (const { key, title, subtitle } of PICKER_TIMEOUTS) {
      const row = new Adw.SpinRow({
        title,
        subtitle,
        adjustment: new Gtk.Adjustment({
          lower: 0,
          upper: 60000,
          step_increment: 50,
          page_increment: 500,
        }),
        digits: 0,
        numeric: true,
      });
      settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
      timingRows.push(row);
      timing.add(row);
    }
    window.connect('close-request', () => {
      for (const row of timingRows) Gio.Settings.unbind(row, 'value');
      return false;
    });

    const shortcutsPage = new Adw.PreferencesPage({
      title: 'Shortcuts',
      icon_name: 'input-keyboard-symbolic',
    });
    window.add(shortcutsPage);
    for (const { title, actions } of SHORTCUT_GROUPS) {
      const group = new Adw.PreferencesGroup({ title });
      shortcutsPage.add(group);
      for (const [key, title] of actions) {
        const row = new Adw.ExpanderRow({ title, use_markup: false });
        group.add(row);
        const contents = new Gtk.Box({
          orientation: Gtk.Orientation.VERTICAL,
          spacing: 8,
          margin_top: 8,
          margin_bottom: 8,
          margin_start: 12,
          margin_end: 12,
        });
        row.add_row(contents);
        const error = new Gtk.Label({ wrap: true, xalign: 0, visible: false });
        error.add_css_class('error');
        const showError = (message) => {
          error.label = message;
          error.visible = true;
          row.expanded = true;
        };
        const save = (values) => {
          try {
            validateShortcuts(settings, key, values, canonicalize);
            if (!settings.set_strv(key, values)) throw new Error('Could not save the shortcut.');
            error.visible = false;
            return true;
          } catch (e) {
            showError(e.message);
            return false;
          }
        };
        const edit = (index = null) => {
          const before = settings.get_strv(key);
          this._capture(window, captureWindows, title, (accelerator) => {
            const values = settings.get_strv(key);
            if (JSON.stringify(values) !== JSON.stringify(before)) {
              showError('Shortcuts changed while recording. Please try again.');
              return false;
            }
            if (index === null) values.push(accelerator);
            else values[index] = accelerator;
            return save(values);
          });
        };
        const refresh = () => {
          while (contents.get_first_child()) contents.remove(contents.get_first_child());
          const values = settings.get_strv(key);
          row.subtitle = values.length ? values.map(shortcutLabel).join(', ') : 'Disabled';
          values.forEach((value, index) => {
            const line = new Gtk.Box({ spacing: 8 });
            const replace = button(shortcutLabel(value), () => edit(index));
            replace.hexpand = true;
            replace.tooltip_text = 'Record a replacement shortcut';
            line.append(replace);
            line.append(
              button('Remove', () => save(settings.get_strv(key).filter((_, i) => i !== index))),
            );
            contents.append(line);
          });
          const controls = new Gtk.Box({ spacing: 8 });
          controls.append(button('Add shortcut', () => edit()));
          controls.append(
            button('Reset to defaults', () => save(settings.get_default_value(key).deep_unpack())),
          );
          contents.append(controls);
          contents.append(error);
        };
        signals.push(settings.connect(`changed::${key}`, refresh));
        refresh();
      }
    }
    extras = new PreferencesExtras(this, window, canonicalize);
    window.set_visible_page(namesPage);
    const mapSignal = window.connect('map', () => {
      window.disconnect(mapSignal);
      focusPageTab(window, namesPage);
    });
  }

  _capture(parent, windows, title, save) {
    const dialog = new Gtk.Window({
      title: `Shortcut: ${title}`,
      transient_for: parent,
      modal: true,
      default_width: 440,
      default_height: 180,
      resizable: false,
    });
    windows.add(dialog);
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 16,
      margin_top: 24,
      margin_bottom: 24,
      margin_start: 24,
      margin_end: 24,
    });
    const prompt = new Gtk.Label({ label: 'Press a shortcut. Escape cancels.', wrap: true });
    box.append(prompt);
    box.append(button('Cancel', () => dialog.close()));
    dialog.set_child(box);
    const controller = new Gtk.EventControllerKey();
    controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
    controller.connect('key-pressed', (_controller, key, _code, state) => {
      if (key === Gdk.KEY_Escape) {
        dialog.close();
        return true;
      }
      const modifiers = state & Gtk.accelerator_get_default_mod_mask();
      const accelerator = canonicalize(Gtk.accelerator_name(key, modifiers));
      if (!accelerator) {
        prompt.label = 'Use a valid shortcut, such as Ctrl+Alt+Left. Escape cancels.';
      } else {
        // The action row displays any validation failure.
        save(accelerator);
        dialog.close();
      }
      return true;
    });
    dialog.add_controller(controller);
    dialog.connect('realize', () => dialog.get_surface().inhibit_system_shortcuts(null));
    dialog.connect('close-request', () => {
      dialog.get_surface()?.restore_system_shortcuts();
      windows.delete(dialog);
      return false;
    });
    dialog.present();
  }
}
