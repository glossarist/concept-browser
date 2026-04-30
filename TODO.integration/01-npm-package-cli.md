# 01 — npm Package with CLI

## Goal

Publish `glossarist-vocabulary-browser` as an npm package providing a CLI for the site build pipeline. The CLI fetches GCR packages from glossary repos, generates JSON-LD data, and builds the SPA.

## Current State

- Scripts are standalone `.mjs` files run via `node scripts/xxx.mjs`
- `fetch-datasets.mjs` — downloads GCR packages from `gcrPackage` URLs or clones repos
- `generate-data.mjs` — converts YAML → JSON-LD static files
- `build-edges.js` — extracts cross-reference edges
- `build-gcr.mjs` — builds GCR packages (THIS MUST BE REMOVED — not our responsibility)
- `package-dataset.mjs` — harmonizes + builds GCR (THIS MUST BE REMOVED — glossarist-ruby's job)
- `datasets.yml` — dataset registry (lives here for now, will move to geolexica.org)

## Tasks

### 1. Add `bin` entry to package.json

```json
{
  "bin": {
    "glossarist-browser": "./bin/glossarist-browser.mjs"
  }
}
```

### 2. Create `bin/glossarist-browser.mjs`

Thin CLI wrapper that delegates to pipeline modules:

```bash
glossarist-browser fetch [--config path/to/datasets.yml] [--output-dir public/data]
glossarist-browser generate [--input-dir .datasets] [--output-dir public/data]
glossarist-browser build-edges [--data-dir public/data]
glossarist-browser build [--data-dir public/data] [--output-dir dist]
glossarist-browser build:full [--config path/to/datasets.yml]  # fetch + generate + edges + build
```

### 3. Refactor scripts into importable modules

- `scripts/fetch-datasets.mjs` → `src/pipeline/fetch.mjs` (exportable `fetchDatasets(config)`)
- `scripts/generate-data.mjs` → `src/pipeline/generate.mjs` (exportable `generateData(options)`)
- `scripts/build-edges.js` → `src/pipeline/edges.mjs`
- Keep the old script paths as thin wrappers for backwards compat (`npm run fetch-datasets`)

### 4. Remove GCR building code

Delete:
- `scripts/build-gcr.mjs` — GCR building is glossarist-ruby's job
- `scripts/package-dataset.mjs` — was a temporary Node.js GCR builder

Remove from CI workflow (`.github/workflows/deploy.yml`):
```yaml
# DELETE THIS STEP
- run: npm run build-gcr:all
```

### 5. Remove `build-gcr` from package.json scripts

```json
// Remove these:
"build-gcr": "node scripts/build-gcr.mjs",
"build-gcr:all": "node scripts/build-gcr.mjs --all",
```

### 6. Update `fetch-datasets.mjs` to remove harmonization

Harmonization (v0→v1 migration) happens in the glossarist-ruby `glossarist package` step. GCR packages arrive pre-harmonized. Remove:
- `harmonizeLanguageBlock()`, `harmonizeConcept()`, `harmonizeDataset()` functions
- `buildRefMaps()`, `extractInlineRefs()` functions
- The harmonize call after cloning

Keep: GCR download, extraction, git clone (fallback), local path override.

### 7. Update `docs/` to reflect new responsibilities

- Update `docs/gcr-spec.md` to reference `glossarist package` CLI
- Update `docs/adding-a-dataset.md` to explain: glossary repo publishes GCR via Ruby gem, browser just downloads it

### 8. Publish to npm

```bash
npm publish --access public
```

## Acceptance Criteria

- [ ] `npx glossarist-browser fetch --config datasets.yml` downloads GCR files
- [ ] `npx glossarist-browser generate` produces JSON-LD
- [ ] `npx glossarist-browser build:full` runs full pipeline
- [ ] No GCR building code remains
- [ ] No harmonization code remains
- [ ] `npm run dev` still works for local development
- [ ] Published on npm as `glossarist-vocabulary-browser`
