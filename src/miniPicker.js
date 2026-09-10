// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Passive shortcut feedback: never grabs input or changes window focus.
export class MiniPicker {
  constructor(extension) {
    this._extension = extension;
    this._frames = [];
    this._timeout = 0;
    this._monitorSignal = Main.layoutManager.connect('monitors-changed', () => this.hide());
    try {
      this._overviewSignal = Main.overview.connect('showing', () => this.hide());
    } catch (error) {
      Main.layoutManager.disconnect(this._monitorSignal);
      throw error;
    }
  }

  show(context, logical) {
    this.hide();
    const ext = this._extension;
    if (ext._picker?._dialog || Main.overview.visible) return;
    const count = ext._workspacesPerContext;
    const target = (context === 'work' ? count : 0) + logical;
    try {
      for (const monitor of Main.layoutManager.monitors) {
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const width = Math.max(70, Math.min(190, (monitor.width / scale - 180) / 6));
        const height = Math.max(45, Math.min(115, (monitor.height / scale - 260) / 3));
        const groups = new St.BoxLayout({
          x_align: Clutter.ActorAlign.CENTER,
          y_align: Clutter.ActorAlign.END,
          style:
            'spacing: 16px; padding: 12px; margin-bottom: 40px; background-color: #282828; border-radius: 12px;',
        });
        const frame = new St.Bin({
          x: monitor.x,
          y: monitor.y,
          width: monitor.width,
          height: monitor.height,
          reactive: false,
          child: groups,
        });
        this._frames.push(frame);
        Main.uiGroup.add_child(frame);
        for (const bank of [context]) {
          const group = new St.BoxLayout({ vertical: true, style: 'spacing: 10px;' });
          groups.add_child(group);
          let row;
          for (let index = 0; index < count; index++) {
            if (index % 3 === 0) {
              row = new St.BoxLayout({ style: 'spacing: 8px;' });
              group.add_child(row);
            }
            const physical = (bank === 'work' ? count : 0) + index;
            const tile = new St.BoxLayout({
              vertical: true,
              style: `padding: 5px; border: 2px solid ${physical === target ? '#e99b45' : '#555555'}; border-radius: 4px;`,
            });
            row.add_child(tile);
            const preview = new St.Widget({
              width,
              height,
              clip_to_allocation: true,
              style: 'background-color: #20242c;',
            });
            tile.add_child(preview);
            const workspace = ext._getWorkspaceByIndex(physical);
            const windows =
              workspace
                ?.list_windows()
                .filter(
                  (window) =>
                    !window.skip_taskbar &&
                    !window.minimized &&
                    window.get_monitor() === monitor.index,
                ) ?? [];
            for (const window of global.display.sort_windows_by_stacking(windows)) {
              const actor = window.get_compositor_private();
              if (!actor) continue;
              const rect = window.get_buffer_rect();
              const clone = new Clutter.Clone({ source: actor, reactive: false });
              clone.set_position(
                ((rect.x - monitor.x) * width) / monitor.width,
                ((rect.y - monitor.y) * height) / monitor.height,
              );
              clone.set_size(
                (rect.width * width) / monitor.width,
                (rect.height * height) / monitor.height,
              );
              preview.add_child(clone);
            }
            tile.add_child(
              new St.Label({
                text: String(index + 1),
                x_align: Clutter.ActorAlign.CENTER,
                style: 'font-size: 14px;',
              }),
            );
          }
          group.add_child(
            new St.Label({
              text: bank === 'personal' ? 'Personal' : 'Work',
              x_align: Clutter.ActorAlign.CENTER,
              style: 'font-size: 18px; font-weight: bold;',
            }),
          );
        }
      }
      let hideAfter = GLib.get_monotonic_time() + 500000;
      this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        const [, , modifiers] = global.get_pointer();
        const held =
          (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0 &&
          (modifiers & Clutter.ModifierType.MOD1_MASK) !== 0;
        const now = GLib.get_monotonic_time();
        if (held) hideAfter = now + 500000;
        if (held || now < hideAfter) return GLib.SOURCE_CONTINUE;
        this._timeout = 0;
        this.hide();
        return GLib.SOURCE_REMOVE;
      });
      ext._log('mini-picker-shown', { targetContext: context, logicalWorkspace: logical + 1 });
    } catch (error) {
      this.hide();
      ext._log('mini-picker-error', { error: String(error), stack: error.stack });
    }
  }

  hide() {
    if (this._timeout) {
      GLib.Source.remove(this._timeout);
      this._timeout = 0;
    }
    for (const frame of this._frames) {
      try {
        frame.destroy();
      } catch (error) {
        console.error(`[environments-switcher] preview-cleanup-error: ${error}`);
      }
    }
    this._frames = [];
  }

  destroy() {
    this.hide();
    Main.layoutManager.disconnect(this._monitorSignal);
    Main.overview.disconnect(this._overviewSignal);
    this._extension = null;
  }
}
