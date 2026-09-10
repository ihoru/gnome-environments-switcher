# Environments Switcher

**Separate Personal and Work into two workspace environments on GNOME Shell.**

[![GNOME Shell 46](https://img.shields.io/badge/GNOME_Shell-46-4a86cf)](https://gjs.guide/extensions/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Navigate by keyboard, move a window and follow it, or choose a workspace from previews on every monitor.

> Version **0.1.0** targets GNOME Shell 46. Installation from source is available below;
> submission to extensions.gnome.org is pending. The full live compatibility matrix remains
> pending in [the release checklist](docs/RELEASING.md).

## How it works

Personal and Work each have nine workspaces by default, arranged as two logical 3 × 3 grids.
The panel shows your environment and workspace number. Switching environments returns to that
one's last workspace.

- A keyboard-controlled picker displays both environments on every monitor.
- Workspace selection switches immediately; Enter or Escape closes the picker.
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

## Install from source

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
limited to 18 per environment by GNOME's 36-workspace limit; the picker remains three columns wide. There is no
preferences window yet. To inspect settings from a clone after building:

```sh
glib-compile-schemas src/schemas
gsettings --schemadir src/schemas list-recursively org.gnome.shell.extensions.environments-switcher
```

Change shortcut keys with `gsettings --schemadir src/schemas set …`, then disable/re-enable the
extension. Keep the internal `native-shortcut-backup` and `desktop-settings-backup` keys intact;
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
- Ordinary navigation is quiet. To enable diagnostic logs from a clone:

```sh
gsettings --schemadir src/schemas set org.gnome.shell.extensions.environments-switcher debug-logging true
journalctl -b -o cat | rg '\[environments-switcher\]'
```

Set `debug-logging` back to `false` after diagnosis. The extension makes no network requests and
does not intentionally log window titles or contents. Review diagnostic details before sharing.

## Contributing and release status

See [Contributing](CONTRIBUTING.md), [Changelog](CHANGELOG.md), and
[Release checklist](docs/RELEASING.md). Report reproducible bugs through GitHub Issues.

Useful next improvements include a preferences UI, translations, theme/accessibility and
reduced-motion improvements, a demonstration with non-sensitive windows, and tested support for
newer GNOME releases.

## License

[MIT](LICENSE). GNOME Shell APIs are supplied by GNOME and retain their own licenses.
[GNOME's review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html#licensing)
explain GPL-compatible distribution on extensions.gnome.org, including permissively licensed code.
