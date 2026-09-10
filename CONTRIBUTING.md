# Contributing

Start with an issue describing a reproducible problem or the user workflow a feature would improve.
For bugs, include GNOME version, distribution, X11/Wayland, monitor layout/scaling, Num Lock state,
other workspace extensions, and expected versus actual behavior. Remove personal information from logs.

## Development

Use Node 24, npm, Python 3, `glib-compile-schemas`, and `gnome-extensions`.

```sh
npm ci
npm run check
```

`npm run format` applies formatting. `npm test` runs behavioral tests; `npm run pack` creates and
verifies the extension ZIP in `dist/`. Development dependencies are not shipped with the extension.

Extension runtime modules, metadata, and GSettings schemas live in `src/`. Tests, build scripts,
and project documentation remain at the repository root. Packaging places the contents of `src/`
at the ZIP root and includes the root `LICENSE`; the archive has no `src/` directory.

For installation, updates, and migration from the old prototype, follow
[Local development installation](docs/LOCAL_DEVELOPMENT.md).

Keep JavaScript readable and compatible with GJS on GNOME 46. Use ES modules and the existing style.
For behavior changes, add focused regression tests. Tests use controlled GNOME substitutes and do not
prove real Shell rendering or compositor behavior. Perform the applicable checks in
[the release checklist](docs/RELEASING.md) using a disposable desktop session.

Preserve user settings, windows, and unrelated work. Every signal, timer, actor, keybinding, and
Shell override must have a teardown path, including partially failed activation. Persist restoration
state before changing external settings and preserve subsequent user edits.

## Pull requests

Explain the problem, resulting behavior, and validation performed. List untested runtime scenarios.
Keep unrelated refactors separate. Update user documentation and the Unreleased changelog for
user-visible changes. Avoid shipping dependencies, logs, local backups, or generated schemas in Git.

Contributions are provided under the repository's MIT license. Attribute any third-party code and
verify its license before adding it. Read the official
[GNOME review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
before changing runtime integration or packaging.
