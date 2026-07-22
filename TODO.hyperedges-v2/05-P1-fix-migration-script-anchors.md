# 05-P1: Fix migration script to preserve YAML anchors

## Problem

`scripts/migrate-vocab-data.mjs` uses `yaml.loadAll()` → `yaml.dump()`.
This silently flattens YAML anchors (&1) and aliases (*1) used heavily
in IALA/OIML concept YAML. The semantic meaning of shared references
is permanently lost.

Also: modifies files in-place with no backup, has no tests, and
produces malformed multi-document YAML (missing leading ---).

## Fix

Option A (preferred): Replace with text-based regex transformation
that preserves all formatting, anchors, and comments.

Option B (fallback): Add backup mechanism (--backup flag copies to
.bak), add anchor preservation via js-yaml's keepNodeAnchors option,
add multi-doc separator fix, add tests.

Either way: rename to `migrate-partitive-plural-to-hyperedges.mjs`
for clarity.

## Verification
- Run on a fixture with YAML anchors — anchors preserved after migration.
- Run twice — second run is a no-op (idempotent).
- Backup files created when --backup flag is used.
- Multi-document YAML output has correct `---` separators.
