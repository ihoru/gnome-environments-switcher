# Changelog

User-visible changes are recorded here. GNOME Extensions marketplace review is tracked separately.

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
