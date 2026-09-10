// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { WorkspaceGroup } from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';

export function gridDirection(from, to, count) {
  const fromBank = Math.floor(from / count);
  const toBank = Math.floor(to / count);
  if (fromBank !== toBank) return { dx: Math.sign(toBank - fromBank), dy: 0 };
  const row = Math.floor((to % count) / 3) - Math.floor((from % count) / 3);
  if (row) return { dx: 0, dy: Math.sign(row) };
  return { dx: Math.sign((to % 3) - (from % 3)), dy: 0 };
}

export class DirectionalAnimation {
  constructor(extension) {
    this._extension = extension;
    this._controller = Main.wm._workspaceAnimation;
    this._original = this._controller.animateSwitch;
    this._run = null;
    this._request = null;
    this._override = (from, to, direction, onComplete) => {
      const request = this._request;
      if (!request || request.from !== from || request.to !== to || this._controller._switchData)
        return this._original.call(this._controller, from, to, direction, onComplete);
      this._animate(from, to, request.vector, onComplete);
    };
    this._controller.animateSwitch = this._override;
    try {
      this._monitorSignal = Main.layoutManager.connect('monitors-changed', () => this._finish());
      this._overviewSignal = Main.overview.connect('showing', () => this._finish());
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  activate(workspace, vector, count) {
    // Finish an interrupted transition before Mutter starts the next one.
    this._finish();
    const from = global.workspace_manager.get_active_workspace_index();
    const to = workspace.index();
    this._request = { from, to, vector: vector ?? gridDirection(from, to, count) };
    try {
      workspace.activate(global.get_current_time());
    } finally {
      this._request = null;
    }
  }

  _animate(from, to, { dx, dy }, onComplete) {
    const controller = this._controller;
    const run = {
      groups: [],
      containers: [],
      onComplete,
      unredirectDisabled: false,
      swipeEnabled: controller._swipeTracker.enabled,
    };
    this._run = run;
    controller._swipeTracker.enabled = false;
    try {
      const monitors = Meta.prefs_get_workspaces_only_on_primary()
        ? [Main.layoutManager.primaryMonitor]
        : Main.layoutManager.monitors;
      const manager = global.workspace_manager;
      for (const monitor of monitors) {
        const group = new Clutter.Actor({
          x: monitor.x,
          y: monitor.y,
          width: monitor.width,
          height: monitor.height,
          clip_to_allocation: true,
        });
        run.groups.push(group);
        const container = new Clutter.Actor();
        group.add_child(container);
        const outgoing = new WorkspaceGroup(
          manager.get_workspace_by_index(from),
          monitor,
          controller.movingWindow,
        );
        container.add_child(outgoing);
        const incoming = new WorkspaceGroup(
          manager.get_workspace_by_index(to),
          monitor,
          controller.movingWindow,
        );
        incoming.set_position(dx * monitor.width, dy * monitor.height);
        container.add_child(incoming);
        group.add_child(new WorkspaceGroup(null, monitor, controller.movingWindow));
        Main.uiGroup.insert_child_above(group, global.window_group);
        run.containers.push({ container, x: -dx * monitor.width, y: -dy * monitor.height });
      }
      Meta.disable_unredirect_for_display(global.display);
      run.unredirectDisabled = true;
      this._extension._log('directional-animation', {
        from: from + 1,
        to: to + 1,
        dx,
        dy,
        monitors: monitors.length,
      });
      let remaining = run.containers.length;
      if (!remaining) this._finish();
      for (const { container, x, y } of run.containers) {
        container.ease({
          x,
          y,
          duration: 250,
          mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
          onComplete: () => {
            if (this._run === run && --remaining === 0) this._finish();
          },
        });
      }
    } catch (error) {
      this._extension._log('directional-animation-error', {
        error: String(error),
        stack: error.stack,
      });
      this._finish();
    }
  }

  _finish() {
    const run = this._run;
    if (!run) return;
    this._run = null;
    const failures = [];
    const clean = (callback) => {
      try {
        callback();
      } catch (error) {
        failures.push(error);
      }
    };
    for (const group of run.groups) clean(() => group.destroy());
    if (run.unredirectDisabled) clean(() => Meta.enable_unredirect_for_display(global.display));
    clean(() => {
      this._controller._swipeTracker.enabled = run.swipeEnabled;
    });
    this._controller.movingWindow = null;
    clean(() => run.onComplete());
    for (const error of failures)
      console.error(`[environments-switcher] animation-cleanup-error: ${error}`);
  }

  destroy() {
    this._finish();
    if (this._controller.animateSwitch === this._override)
      this._controller.animateSwitch = this._original;
    if (this._monitorSignal) Main.layoutManager.disconnect(this._monitorSignal);
    if (this._overviewSignal) Main.overview.disconnect(this._overviewSignal);
    this._monitorSignal = 0;
    this._overviewSignal = 0;
    this._request = null;
    this._extension = null;
  }
}
