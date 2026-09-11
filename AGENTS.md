# Agent guidance

This is a GNOME Shell 46 GJS extension, with Node used only for development checks.
Read README.md for user behavior and docs/RELEASING.md before publication work.

- Preserve the public UUID and existing GSettings schema/path unless migration is explicitly requested.
- Keep GNOME side effects inside enable-time code; unwind partial activation and release all resources
  on disable. Preserve desktop-setting backups and later user edits.
- Run `npm run check` after changes. Add behavioral regressions for runtime fixes; distinguish mocked
  test results from live Shell verification. Test desktop changes in a disposable session.
- Keep the runtime allowlist in scripts/validate.py synchronized with new local imports.
- Use Git for source history; retain unrelated dirty work without creating source backup copies.
  Only install, restart Shell, commit, push, or submit when authorized.
- Update `CHANGELOG.md` for every significant modification before considering the work complete.
  Add entries under `Unreleased`, grouped as `User-facing` (features, behavior, UI, and visible fixes)
  or `Internal` (tests, refactoring, tooling, and contributor/agent guidance). Describe the resulting
  change; keep existing release history intact. Record the landing website once as introduced;
  omit subsequent website-only changes, including styling, content, media, and deployment tweaks.

## Current documentation

Use Context7 MCP for library, framework, SDK, API, CLI, and cloud-service documentation, including
syntax, configuration, migration, setup, and library-specific debugging, even for familiar tools.
Start with `resolve-library-id` using the library name and full question unless an exact `/org/project`
ID was supplied. Select by name/relevance, source reputation, snippets and benchmark score; use a
version-specific ID when appropriate. Retry alternate names if results are unsuitable.
Then call `query-docs` for each distinct concept with the selected ID and a complete question.
Use the fetched documentation; prefer it over web search for library docs. This is unnecessary for
pure refactoring, scripts from scratch, business-logic debugging, code review, or general concepts.

## Agent skills

### Issue tracker

Use GitHub Issues. Read `docs/agents/issue-tracker.md` before ticket operations.

### Triage labels

Use the five canonical labels. Read `docs/agents/triage-labels.md` before triage.

### Domain docs

Use a single-context layout. Read `docs/agents/domain.md` before domain exploration.
