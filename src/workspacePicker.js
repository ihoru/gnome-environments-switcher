// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export class WorkspacePicker {
  constructor(extension) {
    this._extension = extension;
    this._dialog = null;
  }

  toggle() {
    try {
      this._toggle();
    } catch (error) {
      this._dialog?.destroy();
      this._dialog = null;
      this._tiles = [];
      throw error;
    }
  }

  _toggle() {
    if (this._dialog) {
      this._dialog.close();
      return;
    }
    const ext = this._extension;
    const dialog = new ModalDialog.ModalDialog({ shouldFadeOut: false, shellReactive: true });
    this._dialog = dialog;
    dialog.connect('destroy', () => {
      this._dialog = null;
      this._tiles = [];
    });
    // One stage-wide modal grab, with a separate picker panel per monitor.
    // Multiple ModalDialogs would compete for input and block each other.
    dialog.backgroundStack.hide();
    this._tiles = [];
    this._selectedPhysical = ext._activeWorkspaceIndex();
    this._focusMonitor = global.display.get_current_monitor();
    const panels = [];
    for (const monitor of Main.layoutManager.monitors) {
      const { panel, activeButton } = this._buildMonitor(monitor);
      const frame = new St.Bin({
        x: monitor.x,
        y: monitor.y,
        width: monitor.width,
        height: monitor.height,
        child: panel,
      });
      dialog.add_child(frame);
      panels.push({ monitor, activeButton });
    }
    dialog.connect('captured-event', (_actor, event) => {
      if (event.type() !== Clutter.EventType.KEY_PRESS) return Clutter.EVENT_PROPAGATE;
      const key = event.get_key_symbol();
      if (key === Clutter.KEY_Escape) {
        dialog.close();
        return Clutter.EVENT_STOP;
      }
      const directions = new Map([
        [Clutter.KEY_Left, [-1, 0]],
        [Clutter.KEY_Right, [1, 0]],
        [Clutter.KEY_Up, [0, -1]],
        [Clutter.KEY_Down, [0, 1]],
      ]);
      if (directions.has(key)) {
        this._navigate(...directions.get(key));
        return Clutter.EVENT_STOP;
      }
      if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
        dialog.close();
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    });
    const monitorSignal = Main.layoutManager.connect('monitors-changed', () => dialog.close());
    dialog.connect('destroy', () => Main.layoutManager.disconnect(monitorSignal));
    const focused =
      panels.find((item) => item.monitor.index === global.display.get_current_monitor()) ??
      panels[0];
    if (focused?.activeButton) dialog.setInitialKeyFocus(focused.activeButton);
    if (!dialog.open()) {
      ext._log('picker-open-failed');
      dialog.destroy();
    } else {
      ext._log('picker-opened', { monitors: panels.map((item) => item.monitor.index) });
    }
  }

  _select(physical, vector = null) {
    this._selectedPhysical = physical;
    for (const tile of this._tiles) {
      tile.button.set_style(
        'padding: 5px; border-radius: 8px; border: 2px solid ' +
          (tile.physical === physical ? '#e99b45' : '#555555') +
          ';',
      );
    }
    const ext = this._extension;
    if (physical !== ext._activeWorkspaceIndex()) {
      const count = ext._workspacesPerContext;
      const context = physical < count ? 'personal' : 'work';
      Main.overview.hide();
      ext._activateContextWorkspace(context, physical % count, vector);
      ext._log('picker-live-switch', {
        targetContext: context,
        logicalWorkspace: (physical % count) + 1,
      });
    }
  }

  _navigate(dx, dy) {
    const count = this._extension._workspacesPerContext;
    const logical = this._selectedPhysical % count;
    const bank = Math.floor(this._selectedPhysical / count);
    const rows = Math.ceil(count / 3);
    const column = (bank * 3 + (logical % 3) + dx + 6) % 6;
    const row = (Math.floor(logical / 3) + dy + rows) % rows;
    const nextLogical = row * 3 + (column % 3);
    if (nextLogical >= count) return;
    const physical = Math.floor(column / 3) * count + nextLogical;
    this._select(physical, { dx, dy });
    const tile =
      this._tiles.find(
        (item) => item.physical === physical && item.monitor === this._focusMonitor,
      ) ?? this._tiles.find((item) => item.physical === physical);
    tile?.button.grab_key_focus();
    this._extension._log('picker-navigate', {
      physicalWorkspace: physical + 1,
      monitor: this._focusMonitor,
    });
  }

  _buildMonitor(monitor) {
    const ext = this._extension;
    const panel = new St.BoxLayout({
      vertical: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
      style: 'background-color: #282828; border-radius: 16px; padding: 24px; spacing: 16px;',
    });
    panel.add_child(
      new St.Label({
        text: 'Environments',
        x_align: Clutter.ActorAlign.CENTER,
        style: 'font-size: 22px; font-weight: bold;',
      }),
    );
    const groups = new St.BoxLayout({ style: 'spacing: 24px;' });
    panel.add_child(groups);
    const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    const tileWidth = Math.max(70, Math.min(190, (monitor.width / scale - 180) / 6));
    const tileHeight = Math.max(45, Math.min(115, (monitor.height / scale - 260) / 3));
    let activeButton;
    for (const context of ['personal', 'work']) {
      const group = new St.BoxLayout({ vertical: true, style: 'spacing: 10px;' });
      groups.add_child(group);
      let row;
      for (let logical = 0; logical < ext._workspacesPerContext; logical++) {
        if (logical % 3 === 0) {
          row = new St.BoxLayout({ style: 'spacing: 8px;' });
          group.add_child(row);
        }
        const physical = (context === 'work' ? ext._workspacesPerContext : 0) + logical;
        const workspace = ext._getWorkspaceByIndex(physical);
        const selected = physical === ext._activeWorkspaceIndex();
        const button = new St.Button({
          can_focus: true,
          reactive: Boolean(workspace),
          style_class: 'button',
          style: `padding: 5px; border-radius: 8px; border: 2px solid ${selected ? '#e99b45' : '#555555'};`,
          accessible_name: `${context} workspace ${logical + 1}`,
        });
        this._tiles.push({ button, physical, monitor: monitor.index });
        button.connect('key-focus-in', () => {
          this._focusMonitor = monitor.index;
          this._select(physical);
        });
        const content = new St.BoxLayout({ vertical: true, style: 'spacing: 4px;' });
        button.set_child(content);
        const preview = new St.Widget({
          width: tileWidth,
          height: tileHeight,
          clip_to_allocation: true,
          style: 'background-color: #242830; border-radius: 4px;',
        });
        content.add_child(preview);
        const windows =
          workspace
            ?.list_windows()
            .filter(
              (window) =>
                !window.skip_taskbar && !window.minimized && window.get_monitor() === monitor.index,
            ) ?? [];
        for (const window of global.display.sort_windows_by_stacking(windows)) {
          const actor = window.get_compositor_private();
          if (!actor || window.get_monitor() !== monitor.index) continue;
          const rect = window.get_buffer_rect();
          const clone = new Clutter.Clone({ source: actor, reactive: false });
          clone.set_position(
            ((rect.x - monitor.x) * tileWidth) / monitor.width,
            ((rect.y - monitor.y) * tileHeight) / monitor.height,
          );
          clone.set_size(
            (rect.width * tileWidth) / monitor.width,
            (rect.height * tileHeight) / monitor.height,
          );
          preview.add_child(clone);
        }
        const caption = new St.BoxLayout({ x_expand: true });
        caption.add_child(new St.Label({ text: String(logical + 1) }));
        caption.add_child(
          new St.Label({
            text: `${windows.length} window${windows.length === 1 ? '' : 's'}`,
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
          }),
        );
        content.add_child(caption);
        button.connect('clicked', () => {
          ext._log('picker-selected', {
            targetContext: context,
            logicalWorkspace: logical + 1,
            monitor: monitor.index,
          });
          this._focusMonitor = monitor.index;
          this._select(physical);
          button.grab_key_focus();
        });
        row.add_child(button);
        if (selected) activeButton = button;
      }
      group.add_child(
        new St.Label({
          text: context === 'personal' ? 'Personal' : 'Work',
          x_align: Clutter.ActorAlign.CENTER,
          style: 'font-size: 18px; font-weight: bold;',
        }),
      );
    }
    return { panel, activeButton };
  }

  destroy() {
    if (this._dialog) {
      this._dialog.destroy();
      this._dialog = null;
    }
    this._tiles = [];
    this._extension = null;
  }
}
