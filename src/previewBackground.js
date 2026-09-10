// SPDX-License-Identifier: MIT

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';

// The same background treatment sits beneath window clones in both pickers.
export function addPreviewBackground(preview, settings, monitor, width, height) {
  const mode = settings?.get_uint?.('preview-background') ?? 1;
  preview.set_style(
    `background-color: ${mode === 2 ? '#e9e7e5' : 'transparent'}; border-radius: 4px;`,
  );
  if (mode !== 1) return;

  // Preserve GNOME's monitor-sized wallpaper composition, then scale the whole
  // layer to the thumbnail rather than recropping the image to its aspect ratio.
  const layer = new St.Widget({
    width: monitor.width,
    height: monitor.height,
    layout_manager: new Clutter.BinLayout(),
    reactive: false,
  });
  layer.set_scale(width / monitor.width, height / monitor.height);
  preview.add_child(layer);
  const manager = new Background.BackgroundManager({
    container: layer,
    monitorIndex: monitor.index,
    controlPosition: false,
    useContentSize: false,
    vignette: false,
  });
  preview.connect('destroy', () => manager.destroy());
}
