# Release checklist

Version **0.1.0** is dated **2026-09-10** in the changelog. Marketplace upload and review are pending.
This checklist distinguishes automated validation from live runtime testing.

## Automated validation

- [x] Run a clean `npm ci --ignore-scripts` and `npm run check`: 26 tests passed.
- [x] Review the ZIP manifest: runtime modules, metadata, schema, license; no private notes or dev tools.
- [x] Run the pinned Shexli analyzer: zero findings, errors, and warnings.
- [ ] After the first authorized commit/push, confirm the GitHub `Validate` job passes.
- [ ] Set the GitHub default branch to `main` after its first push (GitHub refuses this for an empty repository).
- [ ] Configure a `main` branch rule requiring `Validate`, blocking force pushes/deletion, after that check exists.

The workflow uploads a candidate ZIP; it never publishes a release or submits to GNOME automatically.

## Local Shexli review

After `npm run check`, run the analyzer on the exact ZIP intended for upload:

```sh
virtualenv venv
venv/bin/python -m pip install -r requirements-review.txt
venv/bin/shexli dist/environments-switcher@ihoru.github.io.shell-extension.zip
```

If `venv` already exists, skip its creation. Python 3.12 is the tested interpreter.
The review requirements pin Shexli 0.2.1, tree-sitter 0.25.2, and tree-sitter-javascript 0.25.0.
An unconstrained install selected tree-sitter 0.26.0 and reproduced a segmentation fault on this ZIP;
changing only tree-sitter to 0.25.2 allowed the analysis to complete. Reinstall the pinned requirements
to repair that environment. This is a tested dependency workaround, not a confirmed upstream root cause.

The current scan reports zero findings, errors, and warnings. `disable()` explicitly disconnects
each signal, destroys each owned object, and clears references. Indicator children are released before
their parent, including any left unattached by partial activation. Each cleanup operation retains its
own error handler so one failure does not stop the remaining cleanup. Perform the live teardown checks
below; a clean static scan is not marketplace approval.

Shexli 0.2.1 returns exit code zero even when it reports findings. Inspect the report itself;
use `--format json` for machine-readable findings rather than relying on the exit code.

## Version metadata

Set `src/metadata.json`'s `version-name` to the user-visible extension version (currently `0.1.0`).
Keep it within GNOME's 1–16 character limit using letters, numbers, spaces, and periods.
The npm package version describes development tooling; EGO assigns its own integer `version`,
which remains omitted from source metadata.
Keep metadata's shell-version limited to versions tested below. Record a release date/version in the
changelog only when an actual release is made.

## Live GNOME 46 acceptance — pending

Use a disposable account or VM, snapshot original desktop settings, and record distribution, Shell/GJS
versions, session type, monitors and scaling. Test both X11 and Wayland before claiming coverage.

- [ ] Fresh installation with default dynamic workspaces creates both fixed workspace banks.
- [ ] Existing fixed workspaces and extra occupied workspaces retain their windows.
- [ ] Every workspace shortcut, wraparound direction, both environments, and Num Lock variants work.
- [ ] Window moves preserve destination and focus; missing/sticky windows and failed moves are safe.
- [ ] Picker click/arrows switch live; Enter/keypad Enter/Escape/Super+W close correctly.
- [ ] Multiple monitors show monitor-local previews; monitor hotplug closes transient UI cleanly.
- [ ] Passive previews do not grab focus, survive repeated shortcuts, and hide after modifier release.
- [ ] Animations complete/interruption works; overview, hotplug and disable restore compositor/swipe state.
- [ ] Small workspace counts and incomplete grid rows behave sensibly; no out-of-bank destination is selected.
- [ ] Disable/re-enable repeatedly and lock/unlock with picker/animation activity; no remaining UI, timers,
      grabs, shortcuts, exceptions, or overrides.
- [ ] Desktop preferences, shortcuts and names restore after disable. Test unset defaults, explicit values,
      later user edits, partial activation failure and a Shell/session restart.
- [ ] Restoring fewer workspaces relocates windows without closing them. Dynamic workspace behavior returns.
- [ ] Optional Dash to Dock schema absent/present works; conflicting workspace extensions are documented.
- [ ] Malformed restoration state fails safely without overwriting the original recovery data.
- [ ] Disable the prototype, migrate to the public UUID, and verify saved preferences. Never enable both.

Record results and unresolved failures in the release notes or a follow-up issue. Automated tests cannot replace this matrix.

## Marketplace submission

- [x] Read current [review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
      and [metadata documentation](https://gjs.guide/extensions/overview/anatomy.html).
- [ ] Confirm maintainership, source attribution and licensing; MIT source is distributed on EGO under
      GPL-compatible terms as described in its guidelines.
- [ ] Capture real picker/panel screenshots using non-sensitive windows; check image upload requirements
      in the current submission form. Do not use mock screenshots as runtime evidence.
- [ ] Prepare listing copy from README features/limitations and link the public repository for support.
- [ ] Sign into the maintainer's extensions.gnome.org account and upload the verified ZIP only after
      explicit publication authorization. Follow the upload form's current requirements.
- [ ] Address reviewer feedback, rerun relevant checks and record the accepted marketplace URL/version.
- [ ] After approval, update README installation links and create an authorized GitHub release/tag with
      the matching artifact and changelog. Never imply acceptance before GNOME approves it.

## Future improvements

Preferences UI and shortcut editing; translations; theme and accessibility testing; reduced-motion
support; sanitized screenshots/demo; and ports to newer GNOME versions with their own runtime matrix.
