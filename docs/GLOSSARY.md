# Extension glossary

Terms used in the extension's interface, behavior, settings, and implementation.
Definitions describe this checkout; they are not a claim of live desktop verification.
“Context” in code means “environment” in the interface. “Preview” means the passive
mini-picker, while “workspace preview” means the contents of an individual tile.

## Environments and workspaces

| Element                              | Meaning                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Environment**                      | A named group of GNOME workspaces. It organizes windows but does not isolate applications, accounts, files, notifications, or data.                                 |
| **Personal**                         | First environment; permanent internal ID `personal`. Its display name can be changed.                                                                               |
| **Work**                             | Second environment; permanent internal ID `work`. Its display name can be changed.                                                                                  |
| **Workspace bank**                   | The contiguous range of native workspaces belonging to one environment. Personal comes before Work.                                                                 |
| **Workspace**                        | A GNOME virtual desktop containing windows. The default configuration allocates nine to each environment.                                                           |
| **Logical workspace**                | A workspace's position inside its environment. Displayed as 1–9 by default; represented by a zero-based index in code.                                              |
| **Physical workspace**               | A workspace's zero-based index in GNOME's complete workspace list. With nine per environment, Personal uses 0–8 and Work uses 9–17.                                 |
| **Grid**                             | The three-column arrangement used for navigation and previews. Nine workspaces form a 3 × 3 grid; advanced counts change the number of rows.                        |
| **Active environment and workspace** | The environment and native workspace currently selected.                                                                                                            |
| **Last workspace**                   | The remembered logical position in each environment. Switching environments returns to the destination's last position.                                             |
| **Extra workspace**                  | A native workspace beyond the two managed banks. Existing extras are retained while the extension is enabled.                                                       |
| **Workspace name**                   | A native GNOME label generated from the environment name and position, such as `Personal 1 (1/9)`. Later manual changes take precedence during the enabled session. |
| **Fixed workspaces**                 | A configured workspace count. The extension temporarily disables dynamic workspace creation/removal.                                                                |
| **Session state**                    | Saved navigation and bookkeeping information. It does not relaunch applications or restore their windows after logout.                                              |

## Desktop interface

| Element                           | Meaning                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Panel indicator**               | Top-panel button displaying the current environment and position, such as `Personal: 1 / 9`.                                                                  |
| **Panel menu**                    | Indicator menu containing `Switch to …` and `Move focused window to …` for the other environment.                                                             |
| **Picker / workspace picker**     | Interactive overlay opened with `Super+W`. Shows both environment grids on each monitor; arrows or clicks select a workspace immediately.                     |
| **Preview / mini-picker**         | Passive overlay showing the destination environment after shortcut navigation. It does not capture input or change window focus. Implemented by `MiniPicker`. |
| **Monitor panel / frame**         | The container positioning a picker or preview on one monitor. The full picker shares one input grab across all monitors.                                      |
| **Environment heading**           | Name displayed beneath an environment's grid. Updates when the display name changes.                                                                          |
| **Workspace tile**                | One grid cell containing a workspace preview and number. Full-picker tiles are clickable and also show a window count.                                        |
| **Selection border**              | Colored tile outline marking the selected workspace or preview destination.                                                                                   |
| **Workspace preview / thumbnail** | Scaled wallpaper/background and window representations for that workspace on the current monitor.                                                             |
| **Window clone**                  | A scaled visual copy of a compositor window actor inside a preview. It is not another application window.                                                     |
| **Window count**                  | Number of windows passing the full picker's preview filter on that monitor. Minimized and skip-taskbar windows are excluded.                                  |
| **Workspace background**          | Layer beneath window clones: Transparent (`0`), Desktop wallpaper (`1`, default), or Brighter color (`2`). Shared by Picker and Preview.                      |
| **Accessible name**               | Text identifying a full-picker tile to accessibility tools, using its environment name and workspace number.                                                  |
| **Overview workspace strip**      | GNOME's native overview thumbnails. The extension hides this strip while enabled and restores it during cleanup.                                              |
| **Directional animation**         | Transition between workspaces in the requested direction, including wraparound. Extension-requested transitions use a 250 ms animation.                       |
| **Notification**                  | Shell message reporting an application failure, such as a preference that could not be applied.                                                               |

## Navigation and window actions

| Element                                 | Meaning                                                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Super / Win**                         | Modifier usually labeled with the Windows logo; used by the default picker shortcut.                                                                     |
| **Primary / Ctrl**                      | `<Primary>` in stored shortcuts denotes the Control modifier used here.                                                                                  |
| **KP / keypad**                         | Numeric keypad keys. The mapping follows physical keypad positions: `7,8,9 → 1,2,3`; `4,5,6 → 4,5,6`; `1,2,3 → 7,8,9`.                                   |
| **Num Lock / KP_Insert**                | Keypad number mode; workspace selection expects Num Lock. The default cross-environment move also accepts keypad Insert when Num Lock is off.            |
| **Shortcut / keybinding / accelerator** | A key combination assigned to an action, stored as a string such as `<Super>w`.                                                                          |
| **Shortcut alternative**                | Another combination triggering the same action. An empty alternatives list disables that action.                                                         |
| **Shortcut conflict**                   | A combination already assigned to another extension action. Preferences reject it; conflicting native workspace bindings are temporarily suspended.      |
| **Switch environment**                  | Activate the other environment's last workspace; default `Ctrl+Alt+KP_0`.                                                                                |
| **Previous / next workspace**           | Step backward/forward one logical position; defaults `Ctrl+Alt+Left/Right`.                                                                              |
| **Workspace above / below**             | Step by minus/plus three logical positions; defaults `Ctrl+Alt+Up/Down`.                                                                                 |
| **Wraparound**                          | Continue from the end to the beginning, or vice versa, within an environment's workspace sequence.                                                       |
| **Select workspace**                    | Activate the logical position matching a keypad key; default `Ctrl+Alt+KP_1…KP_9`.                                                                       |
| **Focused window**                      | Window currently receiving keyboard input; the target of window-movement actions.                                                                        |
| **Move and follow**                     | Move the focused window, activate its destination workspace, and focus it again. Directional and keypad move defaults add Shift to navigation shortcuts. |
| **Move to other environment**           | Move and follow while preserving the window's logical workspace number; default `Ctrl+Shift+Alt+KP_0` or `KP_Insert`.                                    |
| **Sticky window**                       | Window visible on all workspaces. Window-movement actions intentionally skip it.                                                                         |
| **Picker timeout**                      | Delay after Super is released, or from opening if it is not held. Default 500 ms. Holding Super again restarts the release countdown.                    |
| **Mini-picker timeout**                 | Delay once Ctrl and Alt are no longer both held. Default 500 ms; holding both again resets the countdown.                                                |
| **Close picker**                        | Enter, keypad Enter, Escape, or the toggle action closes the overlay. The selected workspace remains active; Escape does not undo selection.             |

See [Keyboard shortcuts](../README.md#keyboard-shortcuts) for the default action table.

## Preferences and supporting controls

| Element                               | Meaning                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **General**                           | Preferences page containing Environment names, Picker appearance, and Picker timing.                                                                                                              |
| **First / Second environment**        | Name fields for Personal and Work. Enter or Apply saves a trimmed, nonempty name; Reset restores the original name.                                                                               |
| **Picker appearance**                 | Workspace background selector. Changes appear the next time Picker or Preview opens.                                                                                                              |
| **Picker timing**                     | Two millisecond controls accepting 0–60,000. Changes apply live; zero closes at the next timer tick after release.                                                                                |
| **Shortcuts**                         | Preferences page with Environment actions, Directional navigation, Select workspace, and Move window to workspace groups.                                                                         |
| **Shortcut action row**               | Expandable row with controls to add, replace, remove, or reset shortcut alternatives.                                                                                                             |
| **Shortcut recorder**                 | Dialog capturing a key combination. Escape cancels recording.                                                                                                                                     |
| **Reset**                             | Restore the selected name or action's defaults; it is not a reset of all extension data.                                                                                                          |
| **More**                              | Preferences page containing encouragement, settings files, diagnostics, and project information.                                                                                                  |
| **A little encouragement**            | One randomly selected message from ten entries, followed by a separator.                                                                                                                          |
| **Export settings / Import settings** | Save or load a JSON configuration using a file chooser. Portable values include names, shortcuts, and both timeouts. Background choice, logging, counts, session state, and backups are excluded. |
| **Import validation**                 | Check format, extension identity, supported keys, value types, ranges, names, and shortcut conflicts before applying settings.                                                                    |
| **Status / error label**              | Inline feedback for invalid names, shortcut conflicts, file operations, or link-opening failures.                                                                                                 |
| **Diagnostics**                       | Controls to enable diagnostic logging, open the log file, and copy its path.                                                                                                                      |
| **Diagnostic log**                    | Opt-in, timestamped runtime events appended to `$XDG_STATE_HOME/environments-switcher/diagnostics.log`, normally under `~/.local/state`. Existing contents remain when logging stops.             |
| **About Environments Switcher**       | Version, project/star link, bug report, feature suggestion, author email, and license controls. Links open the corresponding application or website.                                              |
| **Bug / feature draft**               | Prefilled GitHub issue form; opening it does not submit an issue.                                                                                                                                 |

## Settings reference

The schema is [`org.gnome.shell.extensions.environments-switcher`](../src/schemas/org.gnome.shell.extensions.environments-switcher.gschema.xml),
stored at `/org/gnome/shell/extensions/environments-switcher/`.
The table covers every schema key; numbered shortcut families cover keys 1 through 9.

| Key                                                                                               | Meaning / default                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment-name-personal`                                                                       | First display name; `Personal`.                                                                                                                                         |
| `environment-name-work`                                                                           | Second display name; `Work`.                                                                                                                                            |
| `preview-background`                                                                              | Preview background mode; `1` (Desktop wallpaper).                                                                                                                       |
| `picker-timeout-ms`                                                                               | Full-picker release delay; `500`.                                                                                                                                       |
| `mini-picker-timeout-ms`                                                                          | Passive-preview release delay; `500`.                                                                                                                                   |
| `debug-logging`                                                                                   | Diagnostic logging switch; `false`.                                                                                                                                     |
| `environment-picker`                                                                              | Open/close picker shortcut alternatives.                                                                                                                                |
| `toggle-context`                                                                                  | Switch-environment shortcut alternatives.                                                                                                                               |
| `move-other-environment`                                                                          | Cross-environment move-and-follow alternatives.                                                                                                                         |
| `environment-previous`, `environment-next`                                                        | Previous/next workspace alternatives.                                                                                                                                   |
| `environment-up`, `environment-down`                                                              | Vertical workspace alternatives.                                                                                                                                        |
| `environment-move-left`, `environment-move-right`, `environment-move-up`, `environment-move-down` | Directional window-movement alternatives.                                                                                                                               |
| `switch-workspace-1` … `switch-workspace-9`                                                       | Keypad selection alternatives. The suffix identifies the keypad position, not the displayed workspace number.                                                           |
| `move-workspace-1` … `move-workspace-9`                                                           | Keypad move-and-follow alternatives, using the same position mapping.                                                                                                   |
| `workspaces-per-context`                                                                          | Advanced count; default `9`. Schema accepts 1–99, but counts above 18 per environment exceed the supported total of 36 and fail activation. Requires disable/re-enable. |
| `active-context`                                                                                  | Saved environment ID; initially `personal`.                                                                                                                             |
| `last-workspace-personal`, `last-workspace-work`                                                  | Saved zero-based logical positions; initially `0`.                                                                                                                      |
| `context-order`                                                                                   | Legacy migration marker; normal order is `personal,work`.                                                                                                               |
| `window-context-map`                                                                              | JSON window-ID/environment bookkeeping; initially `{}`. IDs from earlier sessions are not trusted as persistent assignments.                                            |
| `initialized`                                                                                     | Whether first-run defaults have been initialized; initially `false`.                                                                                                    |
| `native-shortcut-backup`                                                                          | Internal restoration data for suspended native shortcuts; initially `{}`.                                                                                               |
| `desktop-settings-backup`                                                                         | Internal restoration data for temporary desktop changes; initially `{}`.                                                                                                |

Keep restoration keys intact and do not reset the schema while enabled.

## Desktop integration and lifecycle

| Element                              | Meaning                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enable / disable**                 | Start the extension's integrations / release UI, signals, timers, keybindings, animation overrides, and restore managed settings. Failed activation also triggers cleanup. |
| **Settings transaction**             | Saves original desktop values before writing temporary ones. Restores only values still matching the extension's last write, preserving later user edits.                  |
| **Desktop-setting adapter**          | Small interface used by the transaction to read, validate, write, and reset a particular native setting.                                                                   |
| **Current-workspace-only switching** | Temporary app/window-switcher settings restricting those lists to the current workspace.                                                                                   |
| **Dash to Dock isolation**           | Optional `isolate-workspaces` setting enabled when that extension's schema is available.                                                                                   |
| **Native shortcut backup**           | Saved GNOME workspace bindings, conditionally restored when no longer claimed or on disable.                                                                               |
| **Signal**                           | Event subscription, such as active-workspace, window-created, monitor, overview, or preference changes. Disconnected during cleanup.                                       |
| **Timer / source**                   | Scheduled callback used for polling release state and delayed work; removed when no longer needed.                                                                         |
| **Modal grab**                       | Full-picker input capture shared across monitors. The mini-picker has no such grab.                                                                                        |
| **Animation override**               | Temporary replacement of Shell's workspace animation method for matching extension requests. Other requests use the original method.                                       |
| **Primary-monitor workspace mode**   | Native setting that limits workspace animation to the primary monitor; respected by the animation module.                                                                  |

## Runtime modules and platform elements

| Element                                                         | Role in this extension                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`extension.js`](../src/extension.js)                           | Main entry point: environments, workspaces, windows, desktop settings, panel, keybindings, and lifecycle.                 |
| [`workspacePicker.js`](../src/workspacePicker.js)               | `WorkspacePicker`: interactive grids, selection, monitor panels, and auto-close behavior.                                 |
| [`miniPicker.js`](../src/miniPicker.js)                         | `MiniPicker`: passive destination previews and auto-hide behavior.                                                        |
| [`previewBackground.js`](../src/previewBackground.js)           | Shared background rendering and wallpaper resource cleanup.                                                               |
| [`directionalAnimation.js`](../src/directionalAnimation.js)     | `DirectionalAnimation` and `gridDirection`: transition direction, animation, and cleanup.                                 |
| [`settingsTransaction.js`](../src/settingsTransaction.js)       | `SettingsTransaction`: persistent, conditional desktop-setting restoration.                                               |
| [`diagnosticLog.js`](../src/diagnosticLog.js)                   | `DiagnosticLog`: runtime log-file writes and lifecycle.                                                                   |
| [`prefs.js`](../src/prefs.js)                                   | Preferences entry point: General, Shortcuts, name validation, and shortcut recording.                                     |
| [`preferencesModel.js`](../src/preferencesModel.js)             | Shared environment/action definitions, name/shortcut validation, and timeout definitions.                                 |
| [`preferencesExtras.js`](../src/preferencesExtras.js)           | More page, settings file chooser, project actions, and operation feedback.                                                |
| [`preferencesDiagnostics.js`](../src/preferencesDiagnostics.js) | Diagnostics controls and log-path actions.                                                                                |
| [`settingsTransfer.js`](../src/settingsTransfer.js)             | Portable configuration format, export, validation, and delayed application of imported values.                            |
| [`projectInfo.js`](../src/projectInfo.js)                       | Author details, display version, issue URLs, and encouragement messages.                                                  |
| [`metadata.json`](../src/metadata.json)                         | Public identity, description, version, supported Shell versions, project URL, and settings schema.                        |
| **UUID**                                                        | Public extension ID: `environments-switcher@ihoru.github.io`. The earlier prototype used `environments-switcher@local`.   |
| **GNOME Shell / GJS**                                           | Desktop host and JavaScript runtime for the installed extension. Metadata currently targets Shell 46.                     |
| **GSettings / Gio.Settings / schema**                           | Typed persistent preferences; the XML schema declares keys, defaults, and ranges.                                         |
| **Gio / GLib**                                                  | Imports used for settings, files, cancellation, paths, timers, and timekeeping.                                           |
| **Clutter / actor / clone**                                     | Scene elements used for layout, keyboard events, window previews, and animated transitions.                               |
| **St**                                                          | Shell widgets used for labels, buttons, containers, and theme information.                                                |
| **Meta / Shell**                                                | Workspace/window integration, compositor controls, and keybinding action modes.                                           |
| **Main**                                                        | Access to Shell's panel, overview, layout manager, window manager, and UI group.                                          |
| **PanelMenu / PopupMenu / ModalDialog**                         | Shell components used for the indicator, its menu actions, and picker input capture.                                      |
| **BackgroundManager / WorkspaceGroup / ThumbnailsBox**          | Shell internals used for wallpaper previews, transition contents, and overview-strip handling.                            |
| **Gtk / Adw / Gdk**                                             | GTK 4, libadwaita, and input/display helpers used by the separate preferences interface.                                  |
| **X11 / Wayland**                                               | Desktop session types relevant to loading edited extension code. See the local development guide for reload requirements. |

## Development and distribution

| Element                            | Meaning                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node / npm**                     | Development runtime and task runner; not required by the installed extension.                                                                |
| **Prettier / ESLint**              | Repository formatting and JavaScript lint checks.                                                                                            |
| **Validation / runtime allowlist** | `scripts/validate.py` checks extension structure and permitted packaged runtime modules.                                                     |
| **Behavioral regression tests**    | Node tests with mocked Shell dependencies and Python tooling tests under `tests/`. They do not establish live Shell compatibility.           |
| **Theme regression probe**         | `scripts/check_picker_theme.py` exercises picker labels in a disposable headless session with Yaru themes. Separate from the default checks. |
| **Check pipeline**                 | `npm run check`: formatting, lint, validation, tests, and packaging; its precheck updates the site's CSS version reference.                  |
| **Extension ZIP / packer**         | Installable archive created by `scripts/pack.py` under `dist/`; contains runtime files rather than the entire repository.                    |
| **Local installer**                | `scripts/install_local.py`, used by `dev:install`, installs a checked build. Source edits alone do not update the installed copy.            |
| **Release tooling**                | `scripts/release.py` and repository workflows support distribution; see [Releasing](RELEASING.md).                                           |
| **Project website**                | Separate static page in `site/`, with screenshots, a screencast, and screenshot viewer. It is not extension runtime UI.                      |

For workflows, see [README](../README.md), [Local development](LOCAL_DEVELOPMENT.md),
[Contributing](../CONTRIBUTING.md), and [Website](WEBSITE.md).
