# 03-P0: Remove phantom partitive_relationships config

## Problem

`site-config.example.yml` contains:
```yaml
partitive_relationships:
  input_format: legacy_v65 | hyperedge_v3
  output_format: hyperedge_v3
```

Nothing reads this. `load-site-config.mjs` has no parsing for it. If a
consumer sets it, it's silently ignored. OCP violation: config declared
but not implemented.

The YAML union syntax `legacy_v65 | hyperedge_v3` is also invalid —
it's a single string literal, not a type union.

## Fix

Remove the `partitive_relationships` block from site-config.example.yml.
Document the migration approach as a comment pointing to the migration
script instead.

## Verification
- `site-config.example.yml` no longer contains `partitive_relationships`.
- A grep for `partitive_relationships` in the entire codebase returns
  zero results (excluding TODO files).
