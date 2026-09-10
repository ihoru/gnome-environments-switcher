// SPDX-License-Identifier: MIT

import {
  ENVIRONMENTS,
  PICKER_TIMEOUTS,
  SHORTCUT_GROUPS,
  validateName,
  validateShortcuts,
} from './preferencesModel.js';

export const PORTABLE_SETTINGS = Object.freeze({
  ...Object.fromEntries(PICKER_TIMEOUTS.map(({ key }) => [key, 'i'])),
  ...Object.fromEntries(ENVIRONMENTS.map(({ id }) => [`environment-name-${id}`, 's'])),
  ...Object.fromEntries(
    SHORTCUT_GROUPS.flatMap(({ actions }) => actions.map(([key]) => [key, 'as'])),
  ),
});

export const MAX_SETTINGS_FILE_BYTES = 1024 * 1024;
const FORMAT = 'environments-switcher-settings';

export function exportSettings(settings, metadata) {
  return (
    JSON.stringify(
      {
        format: FORMAT,
        formatVersion: 1,
        extensionUuid: metadata.uuid,
        extensionVersion: metadata['version-name'] ?? String(metadata.version ?? 'Unknown'),
        settings: Object.fromEntries(
          Object.keys(PORTABLE_SETTINGS).map((key) => [key, settings.get_value(key).deep_unpack()]),
        ),
      },
      null,
      2,
    ) + '\n'
  );
}

export function parseSettings(text, uuid, canonicalize) {
  if (text.length > MAX_SETTINGS_FILE_BYTES)
    throw new Error('Settings file is too large (maximum 1 MiB).');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!data || data.format !== FORMAT || data.formatVersion !== 1)
    throw new Error('Unsupported settings file format or version.');
  if (data.extensionUuid !== uuid) throw new Error('This file belongs to a different extension.');
  const values = data.settings;
  if (!values || typeof values !== 'object' || Array.isArray(values))
    throw new Error('The file must contain a settings object.');
  for (const key of Object.keys(values))
    if (!Object.hasOwn(PORTABLE_SETTINGS, key))
      throw new Error(`Unknown or internal setting: ${key}`);
  const validated = {};
  for (const [key, type] of Object.entries(PORTABLE_SETTINGS)) {
    if (!Object.hasOwn(values, key)) {
      // Older exports predate timeout preferences; preserve the destination values.
      if (PICKER_TIMEOUTS.some((item) => item.key === key)) continue;
      throw new Error(`Missing setting: ${key}`);
    }
    const value = values[key];
    if (type === 's') {
      if (typeof value !== 'string') throw new Error(`Invalid name: ${key}`);
      validated[key] = validateName(value);
    } else if (type === 'i') {
      if (!Number.isInteger(value) || value < 0 || value > 60000)
        throw new Error(`Timeout must be a whole number from 0 to 60000 ms: ${key}`);
      validated[key] = value;
    } else if (type === 'as') {
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
        throw new Error(`Invalid shortcut list: ${key}`);
      validated[key] = [...value];
    }
  }
  // Check the complete imported configuration, not the configuration being replaced.
  const snapshot = { get_strv: (key) => validated[key] };
  for (const [key, type] of Object.entries(PORTABLE_SETTINGS))
    if (type === 'as') validateShortcuts(snapshot, key, validated[key], canonicalize);
  return validated;
}

// Use a fresh Gio.Settings instance: delayed mode persists on the instance after apply().
export function applySettings(settings, values, variant) {
  const changes = Object.entries(PORTABLE_SETTINGS).filter(
    ([key]) =>
      Object.hasOwn(values, key) &&
      JSON.stringify(settings.get_value(key).deep_unpack()) !== JSON.stringify(values[key]),
  );
  for (const [key] of changes)
    if (!settings.is_writable(key)) throw new Error(`Setting is locked: ${key}`);
  settings.delay();
  try {
    for (const [key, type] of changes)
      if (!settings.set_value(key, variant(type, values[key])))
        throw new Error(`Could not import: ${key}`);
    settings.apply();
  } catch (error) {
    settings.revert();
    throw error;
  }
}
