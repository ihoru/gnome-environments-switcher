// SPDX-License-Identifier: MIT

export const ENVIRONMENTS = [
  { id: 'personal', title: 'First environment', fallback: 'Personal' },
  { id: 'work', title: 'Second environment', fallback: 'Work' },
];

const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
export const SHORTCUT_GROUPS = [
  {
    title: 'Environment actions',
    actions: [
      ['environment-picker', 'Open or close the picker'],
      ['toggle-context', 'Switch environment'],
      ['move-other-environment', 'Move window to the other environment and follow'],
    ],
  },
  {
    title: 'Directional navigation',
    actions: [
      ['environment-previous', 'Previous workspace'],
      ['environment-next', 'Next workspace'],
      ['environment-up', 'Workspace above'],
      ['environment-down', 'Workspace below'],
      ...['left', 'right', 'up', 'down'].map((direction) => [
        `environment-move-${direction}`,
        `Move window ${direction} and follow`,
      ]),
    ],
  },
  {
    title: 'Select workspace',
    actions: keypad.map((key, index) => [`switch-workspace-${key}`, `Workspace ${index + 1}`]),
  },
  {
    title: 'Move window to workspace',
    actions: keypad.map((key, index) => [
      `move-workspace-${key}`,
      `Move window to workspace ${index + 1} and follow`,
    ]),
  },
];

export function validateName(value) {
  const name = value.trim();
  if (!name) throw new Error('Enter a name.');
  return name;
}

// Validation is atomic for the full alternatives list, including reset-to-defaults.
export function validateShortcuts(settings, key, values, canonicalize) {
  const canonical = values.map(canonicalize);
  if (canonical.some((value) => !value)) throw new Error('Choose a valid shortcut.');
  if (new Set(canonical).size !== canonical.length)
    throw new Error('This action already uses that shortcut.');
  for (const { actions } of SHORTCUT_GROUPS) {
    for (const [otherKey, title] of actions) {
      if (otherKey === key) continue;
      const other = settings.get_strv(otherKey).map(canonicalize);
      if (canonical.some((value) => other.includes(value)))
        throw new Error(`Already assigned to “${title}”. Remove it there first.`);
    }
  }
  return values;
}

export const PICKER_TIMEOUTS = [
  {
    key: 'picker-timeout-ms',
    title: 'Picker timeout (ms)',
    subtitle: 'Delay after Win/Super is released.',
    defaultValue: 500,
  },
  {
    key: 'mini-picker-timeout-ms',
    title: 'Mini-picker timeout (ms)',
    subtitle: 'Delay after workspace-switching modifiers are released.',
    defaultValue: 500,
  },
];
