# 12 — Stale branch cleanup (suggest, don't auto-delete)

## Problem

20+ stale local branches across concept-browser and glossarist-js.
These are merged features, abandoned experiments, or remnants of
past refactors. They clutter `git branch` output and make it hard
to spot active work.

## Per global rules: NEVER auto-delete

> "If cleanup is needed, suggest — do not act. Flag files to the
> user. Suggest moving to an archive directory or adding to
> .gitignore. Never delete without explicit user confirmation."

This file is the **suggestion list**. The user reviews and approves
deletion per branch.

## concept-browser stale branches (merged into main)

To verify each is merged:
```bash
git branch --merged main | grep -v "^\* main$"
```

Suggested candidates for `git branch -d` (delete only after user
confirms):

- feat/sidebar-search-about
- feat/site-config-theming-routing
- fix/inline-ref-extraction-and-display
- fix/sources-edges-rdf-display
- fix/subpath-base-url
- refactor/unify-dataset-metadata-precedence (empty — superseded by fix/wire-about-pages-into-build)

(Other branches may be in-progress work. Don't suggest those.)

## glossarist-js stale branches

Suggested candidates (verify with `git branch --merged main` first):

- chore/update-actions-and-trusted-publishing
- feat/cleanup-adrs-and-uri-pattern-index
- feat/compiled-formats
- feat/dataset-assets
- feat/initial-library-improvements
- feat/iso-19135-relationship-types
- feat/v3-citation-ref-model
- refactor/audit-v0.2.1
- refactor/code-quality-audit
- refactor/remove-deprecations-and-legacy

## Action

User runs (after reviewing):
```bash
# concept-browser
git branch -d feat/sidebar-search-about feat/site-config-theming-routing \
  fix/inline-ref-extraction-and-display fix/sources-edges-rdf-display \
  fix/subpath-base-url refactor/unify-dataset-metadata-precedence

# glossarist-js
git branch -d chore/update-actions-and-trusted-publishing \
  feat/cleanup-adrs-and-uri-pattern-index feat/compiled-formats \
  feat/dataset-assets feat/initial-library-improvements \
  feat/iso-19135-relationship-types feat/v3-citation-ref-model \
  refactor/audit-v0.2.1 refactor/code-quality-audit \
  refactor/remove-deprecations-and-legacy
```

If any branch has unmerged commits, `git branch -d` will refuse.
Investigate before using `-D` (force).

## Deliverable

This file. No code changes. User reviews and executes deletion
manually.
