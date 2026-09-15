# Domain docs

## Layout and reading rules

This repository uses a single-context layout:

- CONTEXT.md at the repository root: domain model and vocabulary.
- docs/adr/: architectural decisions.
- docs/GLOSSARY.md: existing extension terminology reference.

Before domain exploration, read CONTEXT.md if present and relevant ADRs.
Consult docs/GLOSSARY.md when naming extension concepts.

If CONTEXT.md or ADRs are absent, proceed silently. Domain-modeling
creates them when terms or decisions are resolved; setup creates no placeholders.

## Vocabulary and decisions

Use established terms in issues, proposals, hypotheses, and tests.
If CONTEXT.md and the glossary disagree, identify the discrepancy.
Record genuine vocabulary gaps for domain-modeling.

Explicitly flag proposals that contradict an existing ADR and explain why
the decision should be reconsidered.
