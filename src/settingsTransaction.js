// SPDX-License-Identifier: MIT

const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** Persist only allowlisted settings; adapters preserve explicit values vs defaults. */
export class SettingsTransaction {
  constructor(storage, adapters, report = () => {}) {
    this._storage = storage;
    this._adapters = adapters;
    this._report = report;
    const raw = storage.read();
    let entries;
    try {
      entries = JSON.parse(raw);
    } catch {
      throw new Error('Settings restoration backup is invalid JSON; preserve it for recovery.');
    }
    if (!entries || typeof entries !== 'object' || Array.isArray(entries))
      throw new Error('Settings restoration backup must be an object.');
    for (const [id, entry] of Object.entries(entries)) {
      const adapter = adapters[id];
      if (
        !adapter ||
        !entry ||
        !adapter.valid(entry.applied) ||
        !(entry.user === null || adapter.valid(entry.user))
      )
        throw new Error(`Invalid settings restoration entry: ${id}`);
    }
    this._entries = entries;
  }

  _save() {
    this._storage.write(JSON.stringify(this._entries));
  }

  apply(id, value) {
    const adapter = this._adapters[id];
    if (!adapter || !adapter.valid(value)) throw new Error(`Invalid setting: ${id}`);
    const current = adapter.read();
    const previous = this._entries[id];
    // A user edit after our last write takes precedence, including after a crash.
    if (previous && !equal(current, previous.applied)) {
      delete this._entries[id];
      this._save();
      return false;
    }
    if (equal(current, value)) return true;
    this._entries[id] = { user: previous ? previous.user : adapter.user(), applied: value };
    this._save(); // durable before changing the desktop
    adapter.write(value);
    return true;
  }

  restore() {
    for (const [id, entry] of Object.entries(this._entries).reverse()) {
      try {
        const adapter = this._adapters[id];
        if (adapter.available === false) continue;
        if (equal(adapter.read(), entry.applied)) {
          if (entry.user === null) adapter.reset();
          else adapter.write(entry.user);
        }
        delete this._entries[id];
        this._save();
      } catch (error) {
        this._entries[id] = entry;
        this._report(error); // retain failed entries for a later recovery attempt
      }
    }
  }
}
