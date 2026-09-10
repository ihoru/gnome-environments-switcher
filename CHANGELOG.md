# Changelog

Significant user-facing and internal changes are recorded here. GNOME Extensions marketplace review is tracked separately.

## Unreleased

### User-facing

- Introduce the project landing website.

- Use native GNOME theme colors for Picker and Preview panels and Preview tiles, keeping labels readable in light and dark themes.

- Publish a tested extension ZIP and checksum to GitHub Releases automatically when the default-branch version increases.

- Rename the Environments preferences tab to General and update website and documentation labels.
- Focus the General tab when preferences opens, keeping the first name field out of edit focus.

- Add a horizontal separator below the encouragement on the More preferences page.
- Set the default picker timeout to 500 ms; preserve explicitly configured delays.
- Write runtime diagnostic events directly to the displayed log file while logging is enabled,
  including when preferences is closed; retain Open log file and Copy path controls.
- Add configurable picker and mini-picker timeouts in milliseconds, applied live.
- Move the approved encouragement to the top of More and decorate it as a quotation; label the author row explicitly.
- Keep settings transfer limited to environment names, shortcuts, and picker timeouts; exclude logging preferences
  and do not log import/export operations.
- Show one of ten approved productivity jokes and wishes each time preferences opens.
- Add a More preferences tab with JSON settings export/import, project and star links, version,
  MIT license, author feedback email, and prefilled GitHub bug/feature forms.
- Validate imported configuration before applying it and exclude session/restoration state.
  Exclude workspace counts from import/export; keep the existing count unchanged.
- Add preferences for environment names and all existing keyboard shortcuts, applied live.
- Support shortcut alternatives, recording, removal, per-action reset, and conflict validation.
- Update environment labels throughout the panel, menus, pickers, and managed workspace names
  while preserving later manual desktop edits and original restoration state.
- Automatically close the workspace picker 500 milliseconds after Win/Super is released, keeping the
  selected workspace. Holding Win/Super again resets the countdown; opening without it held
  starts the countdown immediately. Enter, Escape, and the picker shortcut still close it early.

### Internal

- Add an opt-in, isolated GNOME regression check for Picker and Preview label contrast under Yaru light and dark themes.

- Add version-bump detection and draft-first release automation with exact-commit tags and safe retries.

- Replace manual journal snapshots with asynchronous append-only runtime logging and lifecycle cleanup.
- Bump the development version to 0.2.0 and cover timeout changes and live file writes with regressions.

- Add versioned settings-file validation, atomic staged imports, file-size limits, and regression tests.
- Add an environment field to the GitHub feature form for diagnostic prefills.

- Package and validate GTK preferences separately from Shell runtime modules.
- Add regression coverage for live preferences, shortcut restoration, picker timing, and cleanup.
- Require categorized changelog entries for significant modifications in agent guidance;
  use Git for source history instead of creating backup copies.

## 0.1.0 — 2026-09-10

### Added

- Personal and Work workspace banks, per-environment last-workspace selection, and a panel menu.
- Keypad and directional workspace navigation, window movement with follow/focus, and environment switching.
- Multi-monitor workspace picker, passive destination previews, and directional animations.
- Public extension identity, MIT license, contributor documentation, and GitHub validation workflow.
- Reproducible packaging with archive-content checks and behavior regression tests.
- Automatic fixed-workspace setup with persistent, conditional restoration of desktop settings.

### Changed

- Move a window to the other environment with `Ctrl+Shift+Alt+Num-0` instead of `Super+Shift+Num-0`.
- Remove `Super+Num-0` and `Super+0` environment switching; retain `Ctrl+Alt+Num-0`.

### Fixed

- Explicit signal and object cleanup passes Shexli review and releases unattached indicator children
  after partial activation, while continuing cleanup after individual failures.
- Local builds show the extension version in the Extensions app using `version-name`.
- Diagnostic navigation logging is opt-in.
- Cleanup continues after individual teardown errors and runs after failed activation.
- Optional desktop integration checks schema availability before creating settings objects.
- Small workspace counts wrap correctly; window context follows its actual workspace.
- Window IDs from previous sessions are not trusted as persistent assignments.

### Compatibility

- Targets GNOME Shell 46. Public-build live desktop verification is pending.
- Public UUID is `environments-switcher@ihoru.github.io`; disable the `@local` prototype before migrating.
