# 14 — Remove dead model-bridge/ split directory

**Priority:** P4
**Status:** pending
**Estimated effort:** small

## Context

Two model-bridge paths exist in the codebase:
- `src/adapters/model-bridge.ts` — the LEGACY single file, actually used by all runtime imports
- `src/adapters/model-bridge/` — a split directory (concept.ts, hyperedge.ts, mappers.ts, etc.), intended as a refactor but NEVER wired into runtime. All callers import from the legacy file.

The split directory is dead code. It was flagged as a root cause of the generic-relations sphere bug (PR #154) — changes landed in the dead directory while runtime used the legacy file.

## Scope

Two options:

**Option A — delete the split directory** (simplest, recommended):
- Delete `src/adapters/model-bridge/` entirely
- No imports change (callers already use the legacy file)
- Document the decision in git history

**Option B — complete the refactor** (proper but large):
- Move the split directory's logic into the legacy file
- Update all imports from `'./model-bridge'` to `'./model-bridge'` (index re-exports)
- Delete the legacy file
- This is the proper DRY refactor but risks regressions

**Recommend Option A** — the split directory was never wired up; deleting it removes confusion without behavior change.

## Acceptance criteria

- [ ] Dead code removed
- [ ] `vue-tsc --noEmit` passes
- [ ] No runtime behavior change
