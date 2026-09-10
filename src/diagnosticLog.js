// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

function operation(object, method, finish, args) {
  return new Promise((resolve, reject) => {
    object[method](...args, (source, result) => {
      try {
        resolve(source[finish](result));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export class DiagnosticLog {
  constructor() {
    this._directory = GLib.build_filenamev([GLib.get_user_state_dir(), 'environments-switcher']);
    this._file = Gio.File.new_for_path(GLib.build_filenamev([this._directory, 'diagnostics.log']));
    this._cancellable = new Gio.Cancellable();
    this._pending = [];
    this._closed = false;
    this._writing = false;
  }

  write(message) {
    if (this._closed) return;
    this._pending.push(`${new Date().toISOString()} ${message}\n`);
    if (!this._writing) void this._flush();
  }

  async _flush() {
    this._writing = true;
    let stream;
    try {
      if (GLib.mkdir_with_parents(this._directory, 0o700) !== 0)
        throw new Error('Cannot create diagnostic log directory');
      stream = await operation(this._file, 'append_to_async', 'append_to_finish', [
        Gio.FileCreateFlags.PRIVATE,
        GLib.PRIORITY_DEFAULT,
        this._cancellable,
      ]);
      while (!this._closed && this._pending.length) {
        const bytes = new TextEncoder().encode(this._pending.splice(0).join(''));
        let offset = 0;
        while (offset < bytes.length) {
          // GBytes retains its storage across async calls; raw arrays can be collected early.
          const written = await operation(stream, 'write_bytes_async', 'write_bytes_finish', [
            new GLib.Bytes(bytes.subarray(offset)),
            GLib.PRIORITY_DEFAULT,
            this._cancellable,
          ]);
          if (written <= 0) throw new Error('Cannot make progress writing diagnostic log');
          offset += written;
        }
      }
    } catch (error) {
      this._pending = [];
      if (!this._closed) console.error(`[environments-switcher] log-file-error: ${error}`);
    } finally {
      if (stream) {
        try {
          await operation(stream, 'close_async', 'close_finish', [GLib.PRIORITY_DEFAULT, null]);
        } catch (error) {
          if (!this._closed) console.error(`[environments-switcher] log-close-error: ${error}`);
        }
      }
      this._writing = false;
      if (!this._closed && this._pending.length) void this._flush();
    }
  }

  destroy() {
    this._closed = true;
    this._pending = [];
    this._cancellable.cancel();
  }
}
