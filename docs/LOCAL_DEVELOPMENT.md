# Local development installation

Use GNOME Shell 46 and the build prerequisites in [README](../README.md#install-from-source).
Run commands from the repository root as your normal user. This project currently uses npm and
Node 24 for development checks; the installed extension runs in GJS.

Test desktop behavior in a disposable GNOME account or VM as described in the
[release checklist](RELEASING.md). The automated checks do not verify live Shell behavior.

## Build the current checkout

```sh
npm ci
npm run check
```

The check includes packaging and produces
`dist/environments-switcher@ihoru.github.io.shell-extension.zip`.
Runtime sources are in `src/`; packaging puts them at the ZIP root alongside the license.
Install this bundle rather than copying the repository root into GNOME's extensions directory.

## Replace the old version

1. Disable the installed version before installing the replacement. Run the applicable command,
   or both if both versions are installed:

   ```sh
   # Old local prototype
   gnome-extensions disable environments-switcher@local
   # Previous build from this repository
   gnome-extensions disable environments-switcher@ihoru.github.io
   ```

   Disabling lets the extension restore the desktop settings it temporarily changed. An unknown-UUID
   error means that version is not registered in the current Shell session. Neither version should be
   active when you proceed. Never enable both together: they share shortcuts and the settings schema/path.

2. Install the newly built bundle:

   ```sh
   gnome-extensions install --force dist/environments-switcher@ihoru.github.io.shell-extension.zip
   ```

   `--force` replaces an existing installation of the public UUID. It does not replace or delete
   `environments-switcher@local`; leave that prototype installed but disabled until verification is complete.
   The usual destination is `~/.local/share/gnome-shell/extensions/environments-switcher@ihoru.github.io/`
   (under `$XDG_DATA_HOME` instead if configured).

3. Reload the session so GNOME loads the new JavaScript:

   - **X11:** press `Alt+F2`, type `r`, and press Enter, or log out and back in.
   - **Wayland:** save your work, then log out and back in.

   A disable/enable cycle alone is insufficient for reliably loading edited JavaScript modules.

4. Enable and inspect the new version:

   ```sh
   gnome-extensions enable environments-switcher@ihoru.github.io
   gnome-extensions info environments-switcher@ihoru.github.io
   ```

   The metadata display version is `0.1.0`. GNOME Extensions supports `version-name`; the separate
   Extension Manager app needs version 0.6.0 or newer. Extension Manager 0.5.0 can leave the Version
   row blank even when the correct metadata is loaded. See its
   [0.6.0 release notes](https://github.com/mjakeman/extension-manager/releases/tag/v0.6.0).
   Confirm the public UUID is active and its path points to the expected installation. Check the
   panel indicator, `Super+W` picker, environment switching, and moving a window. If the prototype is
   installed, inspect it with `gnome-extensions info environments-switcher@local` and confirm it is inactive.
   If the new UUID is unknown, make sure you completed the session reload after installation.

Shortcuts and environment preferences use the existing settings schema/path. Do not reset the schema
or clear the `native-shortcut-backup` / `desktop-settings-backup` keys; those preserve restoration state.
The public build cannot reconstruct old prototype desktop changes that were never backed up.

## After each source edit

Edit files in `src/`, then run:

```sh
npm run dev:install
```

This runs all checks, builds the ZIP, disables registered old versions, installs the bundle,
and re-enables the public UUID if Shell already knows it. It does not create installation backups;
rebuild an earlier checkout to roll back. A failed check stops installation. If installation fails after
disabling, the old versions remain disabled. The command prints reload instructions.
For a first installation, Shell may need a session reload before the enable command can succeed;
follow the command printed by the script after reloading.

**Reload Shell on X11 or log out/in on Wayland after the command.** Re-enabling in the existing
session can still execute cached code. The new JavaScript is only reliably loaded after this reload.
The command does not restart Shell or log you out automatically.

Re-run `npm ci` when the lockfile changes. The installed files are a separate copy; editing the
checkout does not update the running extension.

### Could I use a symlink instead?

Yes: the UUID-named directory under `~/.local/share/gnome-shell/extensions/` can point to this
checkout's `src/` directory. It must point to `src/`, which contains `extension.js` and `metadata.json`,
not the repository root. Disable an existing installation before replacing its directory.
Compile schemas with `glib-compile-schemas src/schemas` initially and after schema edits.

A symlink avoids copying files, but **does not provide JavaScript hot reload**: you still need a new
Shell process after code changes. The `dev:install` command uses the verified ZIP and refuses to
replace a symlink, so it cannot overwrite files in a linked checkout. Choose one installation method.
See [GNOME's reload documentation](https://gjs.guide/extensions/development/debugging.html#reloading-extensions).

## Roll back

Disable the public build first:

```sh
gnome-extensions disable environments-switcher@ihoru.github.io
```

To return to the retained prototype, reload Shell or log out/in, then run:

```sh
gnome-extensions enable environments-switcher@local
```

To return to an earlier public build, run `npm ci` and `npm run dev:install` from a separate checkout
of that revision, then reload the session. You can also reinstall a saved ZIP with `--force`.

See [GNOME's extension structure documentation](https://gjs.guide/extensions/overview/anatomy.html)
for the UUID-based installation layout.

## Picker theme regression

On a GNOME Shell 46 machine with Yaru light/dark themes installed, run:

```sh
python3 scripts/check_picker_theme.py
```

This opt-in check starts a disposable headless GNOME session with separate XDG directories
and a keyfile settings backend. It renders the actual Picker and Preview modules against both
themes and requires at least 4.5:1 foreground/background contrast for their heading labels.
It does not install into or change the running desktop. Test output and Shell logs remain in
the printed temporary directory. It is separate from `npm run check` because it needs a
working nested compositor and the installed Yaru themes.
