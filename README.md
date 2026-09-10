# Environments Switcher

**Separate Personal and Work into two workspace environments on GNOME Shell.**

[![GNOME Shell 46](https://img.shields.io/badge/GNOME_Shell-46-4a86cf)](https://gjs.guide/extensions/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Navigate by keyboard, move a window and follow it, or choose a workspace from previews on every monitor.

> Version **0.2.0** targets GNOME Shell 46. Installation options are listed below;
> See the GNOME Extensions page or download a GitHub release ZIP. The full live compatibility matrix remains
> pending in [the release checklist](docs/RELEASING.md).

## How it works

Personal and Work each have nine workspaces by default, arranged as two logical 3 × 3 grids.
The panel shows your environment and workspace number. Switching environments returns to that
one's last workspace.

- A keyboard-controlled picker displays both environments on every monitor.
- Workspace selection switches immediately. The picker closes 500 milliseconds after Win/Super is
  released; holding Win/Super again resets the countdown. If opened without it held, the countdown
  starts immediately. Enter or Escape closes it early. The delay is configurable in preferences.
- Window-movement shortcuts follow the window and keep focus.
- A passive preview shows the destination environment while modifiers are held and briefly after release.
- Directional animations follow navigation, including wraparound.

These environments organize GNOME workspaces. They do **not** isolate applications, files,
notifications, accounts, or data. Sticky windows remain visible across workspaces. This is not
session restoration: applications and their windows are not relaunched after logout.

## Keyboard shortcuts

`Super` is usually the Windows key. `KP` means the numeric keypad.

| Action                                          | Default shortcut                   |
| ----------------------------------------------- | ---------------------------------- |
| Open/close the picker                           | `Super+W`                          |
| Switch environment                              | `Ctrl+Alt+KP_0`                    |
| Move window to the other environment and follow | `Ctrl+Shift+Alt+KP_0`              |
| Previous/next workspace within the environment  | `Ctrl+Alt+Left/Right`              |
| Move up/down three workspaces, with wraparound  | `Ctrl+Alt+Up/Down`                 |
| Move window in a direction and follow           | `Ctrl+Shift+Alt+Arrow`             |
| Select workspace by keypad position             | `Ctrl+Alt+KP_1…KP_9`               |
| Move window by keypad position and follow       | `Ctrl+Shift+Alt+KP_1…KP_9`         |
| Navigate inside the picker                      | Arrow keys or click                |
| Close picker, keeping selected workspace        | `Enter`, keypad Enter, or `Escape` |

Keypad positions map to workspace numbers as follows:

| Keypad      | Workspace   |
| ----------- | ----------- |
| `7` `8` `9` | `1` `2` `3` |
| `4` `5` `6` | `4` `5` `6` |
| `1` `2` `3` | `7` `8` `9` |

Use Num Lock for keypad workspace selection. The cross-environment window-movement shortcut also includes
`KP_Insert` for Num Lock off. Moving a sticky window is intentionally skipped.

## Installation

### 1. GNOME Extensions website — easiest

Visit [Environments Switcher on GNOME Extensions](https://extensions.gnome.org/extension/10924/environments-switcher/)
for installation through the GNOME Extensions website.

### 2. Download a GitHub release ZIP — no cloning

[Download the latest extension ZIP](https://github.com/ihoru/gnome-environments-switcher/releases/latest/download/environments-switcher@ihoru.github.io.shell-extension.zip).
This permanent link follows the latest GitHub release automatically. It downloads the installable
extension, not a source-code archive.

On GNOME Shell 46, disable an existing installation first:

```sh
gnome-extensions disable environments-switcher@ihoru.github.io
```

Skip that command on a first installation. If using the old prototype, disable
`environments-switcher@local` instead. Download and install the latest release as your normal
user with `wget` and `gnome-extensions` (no Node or build tools needed):

```sh
zip=$(mktemp --suffix=.shell-extension.zip) &&
wget -O "$zip" \
  https://github.com/ihoru/gnome-environments-switcher/releases/latest/download/environments-switcher@ihoru.github.io.shell-extension.zip &&
gnome-extensions install --force "$zip" &&
rm -f "$zip"
```

The command uses a unique temporary file, installs only after a successful download, and removes
the file after successful installation. Log out and back in, then enable it in the Extensions app or run:

```sh
gnome-extensions enable environments-switcher@ihoru.github.io
```

### 3. Install from source

<a id="install-from-source"></a>

Runtime requires GNOME Shell **46** and GJS. Node is only used for development checks.
For building on Ubuntu 24.04, install the tools:

```sh
sudo apt install gnome-shell gnome-shell-extension-prefs libglib2.0-bin python3
```

Clone the repository, use Node 24, and build:

```sh
git clone https://github.com/ihoru/gnome-environments-switcher.git
cd gnome-environments-switcher
npm ci
npm run check
```

Before installing, disable the old version if present:

- Prototype: `gnome-extensions disable environments-switcher@local`
- Existing public build: `gnome-extensions disable environments-switcher@ihoru.github.io`

Then install the checked bundle as your normal user:

```sh
gnome-extensions install --force dist/environments-switcher@ihoru.github.io.shell-extension.zip
```

Log out and back in, then enable through the Extensions app or:

```sh
gnome-extensions enable environments-switcher@ihoru.github.io
```

On X11, `Alt+F2`, `r`, Enter can reload Shell instead. Wayland requires logout/login.
Disabling and enabling alone may keep old JavaScript modules cached.

### Local development and replacing the prototype

Follow [Local development installation](docs/LOCAL_DEVELOPMENT.md) for replacing the old
`environments-switcher@local` prototype, rebuilding after edits, verification, and rollback.
After initial setup, run `npm run dev:install` to check and install local changes.
Then reload Shell (X11) or log out/in (Wayland) to load the new code.
Edit files in `src/`; edits in the checkout do not update the installed copy.

Both versions use the same settings schema/path, preserving shortcuts and environment preferences.
Never enable both together. Keep the old copy until the new build has been verified; migration does
not delete or overwrite it. Old prototype desktop changes that were never backed up cannot be
reconstructed by the public build.

## Settings and desktop changes

The extension temporarily configures fixed workspaces, workspace names, current-workspace-only
app/window switching, and Dash to Dock workspace isolation when that schema is available.
Conflicting native workspace shortcuts are temporarily suspended. It also hides GNOME's overview
workspace strip and replaces extension-requested workspace animations.

Original settings are saved before changes and restored on disable when their current values still
match the extension's last write. Later user edits take precedence. Restoring fewer workspaces can
relocate windows onto remaining workspaces; it does not close them. Unrelated extra workspaces are
retained while enabled and are outside the two environment banks.

Nine workspaces per environment is the tested design target. Other counts are advanced settings,
limited to 18 per environment by GNOME's 36-workspace limit; the picker remains three columns wide. Workspace counts remain advanced settings and are not exposed in preferences.
To inspect settings from a clone after building:

```sh
glib-compile-schemas src/schemas
gsettings --schemadir src/schemas list-recursively org.gnome.shell.extensions.environments-switcher
```

Open **Settings** for Environments Switcher in the Extensions app to edit environment names
and shortcuts. Saved changes apply immediately while the extension is enabled.

- **General:** enter a name and press Enter or Apply; blank names are rejected. Reset restores
  the original display name. Renaming does not move windows or change workspace counts.
  **Picker timing** sets picker and mini-picker delays in milliseconds (defaults: 500 for both).
  Values from 0 to 60,000 apply live; zero closes at the next timer tick after modifier release.
- **Shortcuts:** expand an action to add, replace, or remove shortcut alternatives, or restore
  that action’s defaults. Press Escape to cancel recording. Conflicts with another extension
  action are rejected; remove the conflicting assignment first. An empty list disables the action.
- **More:** export/import a JSON configuration file, visit the project and give it a star, open
  prefilled bug reports or feature requests, and view version, author contact, and license details.
  One of ten short productivity messages is selected at random when preferences opens.
  Import replaces names, shortcuts, and picker timeouts after validating the complete file. Diagnostic logging,
  workspace count, session state, and desktop-setting restoration backups are excluded.
- Native workspace shortcuts claimed by the extension are restored when released, provided they
  have not subsequently been edited outside the extension. Other extensions may still compete
  for shortcuts. Application failures appear as Shell notifications.

Name changes also update extension-managed GNOME workspace names. Manual changes to native workspace
names take precedence for the rest of the enabled session. Original desktop settings remain available
for restoration when the extension is disabled.

Workspace-count changes made with `gsettings` still require disabling/re-enabling the extension. Keep the internal `native-shortcut-backup` and `desktop-settings-backup` keys intact;
they contain restoration state. Do not reset the schema while enabled.

### Disable or remove

```sh
gnome-extensions disable environments-switcher@ihoru.github.io
gnome-extensions uninstall environments-switcher@ihoru.github.io
```

Disable first so desktop settings are restored. Uninstallation does not promise to erase saved
preferences. If restoration fails, preserve the backup keys and report the journal error.

## Troubleshooting and compatibility

- GNOME versions other than 46 are not declared supported. Do not bypass version validation.
- Avoid combining with Workspace Matrix or extensions that replace workspace animations,
  thumbnail strips, or the same shortcuts. No other extensions are automatically disabled.
- Final public-build X11/Wayland, multi-monitor animation, modifier timing and lifecycle checks
  are pending; see the release checklist rather than treating automated tests as desktop validation.
- If a shortcut fails, inspect GNOME keyboard settings and other extensions for collisions.
- In **More → Diagnostics**, check **Enable diagnostic logging** and reproduce the problem.
  The enabled extension appends timestamped runtime events directly to the displayed log file,
  even with preferences closed. **Open log file** and **Copy path** help collect relevant lines.
  Logs are saved to `$XDG_STATE_HOME/environments-switcher/diagnostics.log`
  (normally `~/.local/state/environments-switcher/diagnostics.log`). Reload the file in your editor
  to see new lines. Unchecking logging stops file writes. Existing log contents are retained.
  Import/export does not change logging or record file-transfer operations.
- Ordinary navigation is quiet. To enable diagnostic logs from a clone:

```sh
gsettings --schemadir src/schemas set org.gnome.shell.extensions.environments-switcher debug-logging true
journalctl -b -o cat | rg '\[environments-switcher\]'
```

Set `debug-logging` back to `false` after diagnosis. The extension makes no network requests and
does not intentionally log window titles or contents. Review diagnostic details before sharing.

## Project website

The static project page is prepared in `site/`, with six screenshots and a demo screencast.
See [Website preview, media, and publication](docs/WEBSITE.md) to preview it locally, add media,
and publish later through the manual GitHub Pages workflow.

## Contributing and release status

See [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md), and
[Release checklist](docs/RELEASING.md). Report reproducible bugs through GitHub Issues.

Useful next improvements include translations, theme/accessibility and
reduced-motion improvements, a demonstration with non-sensitive windows, and tested support for
newer GNOME releases.

## License

[MIT](LICENSE). GNOME Shell APIs are supplied by GNOME and retain their own licenses.
[GNOME's review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#licensing)
explain GPL-compatible distribution on extensions.gnome.org, including permissively licensed code.
