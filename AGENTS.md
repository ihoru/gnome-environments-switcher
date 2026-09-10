# Agent guidance

This is a GNOME Shell 46 GJS extension, with Node used only for development checks.
Read README.md for user behavior and docs/RELEASING.md before publication work.

- Preserve the public UUID and existing GSettings schema/path unless migration is explicitly requested.
- Keep GNOME side effects inside enable-time code; unwind partial activation and release all resources
  on disable. Preserve desktop-setting backups and later user edits.
- Run `npm run check` after changes. Add behavioral regressions for runtime fixes; distinguish mocked
  test results from live Shell verification. Test desktop changes in a disposable session.
- Keep the runtime allowlist in scripts/validate.py synchronized with new local imports.
- Back up existing files before substantial edits; retain unrelated dirty work. Keep backups outside
  the publication tree. Only install, restart Shell, commit, push, or submit when authorized.

## Current documentation

Use Context7 MCP for library, framework, SDK, API, CLI, and cloud-service documentation, including
syntax, configuration, migration, setup, and library-specific debugging, even for familiar tools.
Start with `resolve-library-id` using the library name and full question unless an exact `/org/project`
ID was supplied. Select by name/relevance, source reputation, snippets and benchmark score; use a
version-specific ID when appropriate. Retry alternate names if results are unsuitable.
Then call `query-docs` for each distinct concept with the selected ID and a complete question.
Use the fetched documentation; prefer it over web search for library docs. This is unnecessary for
pure refactoring, scripts from scratch, business-logic debugging, code review, or general concepts.
