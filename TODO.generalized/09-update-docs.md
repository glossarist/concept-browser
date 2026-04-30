# Status: DONE

# 09 — Update Documentation

## Context

`docs/adding-a-dataset.md` is outdated — it references the old color system (per-dataset Tailwind colors, `dsColor()` functions), old CLI flags (`--input`, `--id`), and inline cross-reference patterns that are being removed. The new pipeline uses `datasets.yml` + `fetch-datasets` + `generate-data` with no code changes.

## Task

### Rewrite `docs/adding-a-dataset.md`

Reflect the new pipeline:

1. Add entry to `datasets.yml` (id, sourceRepo, owner, color, tags)
2. Run `npm run fetch-datasets && npm run generate-data && npm run build-edges`
3. No code changes needed
4. Reference `docs/dataset-schema.md` for canonical concept format
5. Reference `docs/gcr-spec.md` for GCR packaging format

Remove all references to:
- Per-dataset Tailwind color configuration
- `dsColor()`, `dsAccent()`, `REGISTER_COLORS` functions
- Inline cross-reference patterns (`{{...IEV:...}}`, `{urn:iso:...}`)
- `--input`, `--id`, `--title` CLI flags
- Manual `datasets.json` editing

### Update `docs/architecture.md`

Update data pipeline description to reflect:
- Source repos → `datasets.yml` + `fetch-datasets.mjs` → `.datasets/`
- `.datasets/` → `generate-data.mjs` (canonical format only) → `public/data/`
- No format-variant handling

### Update `CLAUDE.md`

Update to reflect:
- `datasets.yml` as the dataset registry (not `DATASETS` array in generate-data.mjs)
- `npm run fetch-datasets` command
- `npm run build:full` command
- GCR packaging format reference
- Canonical concept format

## Files

- Modify: `docs/adding-a-dataset.md`
- Modify: `docs/architecture.md`
- Modify: `CLAUDE.md`

## Verification

- No references to old color system remain
- No references to hardcoded paths remain
- Pipeline documentation matches actual scripts
