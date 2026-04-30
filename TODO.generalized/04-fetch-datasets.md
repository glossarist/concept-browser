# Status: DONE

# 04 — Create scripts/fetch-datasets.mjs

## Context

Currently dataset source directories are hardcoded absolute paths in `generate-data.mjs` (lines 11-13). Need a script that reads `datasets.yml`, clones/updates the source repos, and makes them available for data generation.

## Task

Create `scripts/fetch-datasets.mjs` that:

1. Reads `datasets.yml` (using `js-yaml`, already a devDependency)
2. For each dataset:
   - Check `DATASET_SOURCE_{ID}` env var for local path override
   - If no override, `git clone --depth 1` into `.datasets/{id}/` (or `git fetch` + `reset` if exists)
   - Supports `GITHUB_TOKEN` for private repos
3. Reads `.datasets/{id}/register.yaml` for metadata (title, description, languages)
4. Validates source directory exists with `.yaml` concept files
5. Outputs resolved metadata

### Key implementation details

- Use `child_process.execSync` for git operations
- Clone with `--depth 1` for speed (we don't need history)
- If `.datasets/{id}/` already exists, do `git fetch origin && git reset --hard origin/HEAD`
- Read `register.yaml` for `name` (→ title), `description`, `subregisters` (→ languages)
- Exit gracefully if a repo fails (don't block other datasets)
- Support `DATASET_SOURCE_IEV=/local/path` env var override for development

### Example usage

```bash
npm run fetch-datasets
# or with local override:
DATASET_SOURCE_IEV=/Users/me/src/glossarist/glossarist-data-iev npm run fetch-datasets
```

## Files

- Create: `scripts/fetch-datasets.mjs`
- Modify: `package.json` — add `"fetch-datasets": "node scripts/fetch-datasets.mjs"` script

## Verification

- `npm run fetch-datasets` creates `.datasets/` with all 4 repos
- Re-running updates existing repos without errors
- `DATASET_SOURCE_IEV=/local/path npm run fetch-datasets` uses local path
