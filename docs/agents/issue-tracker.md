# Issue tracker: GitHub

Issues and specs live in ihoru/gnome-environments-switcher on GitHub.
Use the gh CLI from this checkout.

## Conventions

- Publishing to the issue tracker means creating a GitHub issue.
- Fetching a ticket includes its body, labels, and comments.
- Use temporary files with --body-file for multiline issue bodies and comments.
- Resolve whether a referenced number identifies an issue or a pull request.
- Tracker configuration does not authorize posting; follow the user's task scope.

## Pull requests as a triage surface

PRs as a request surface: no.

## Wayfinding

- Keep the map in one issue labeled wayfinder:map.
- Link child tickets as sub-issues; otherwise use a map task list and
  a Part of #<map> reference in each child.
- Label children wayfinder:research, wayfinder:prototype,
  wayfinder:grilling, or wayfinder:task.
- Record blockers using native issue dependencies where available;
  otherwise use a Blocked by reference.
- Select the first open, unassigned child in map order with no open blockers.
- Claim by assigning the driving developer.
- Resolve with findings, close the child, and link the result from the map.
