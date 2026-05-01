# 01 — Remove GCR Building, Prepare npm Package CLI

## Goal

The vocabulary-browser should ONLY consume GCR packages — never build them. GCR building is the glossarist Ruby gem's job.

## What Changed

### Removed
- `scripts/build-gcr.mjs` — GCR building is glossarist-ruby's job
- `scripts/package-dataset.mjs` — was a temporary Node.js GCR builder
- `build-gcr` and `build-gcr:all` scripts from package.json
- Harmonization code from `fetch-datasets.mjs` (`harmonizeLanguageBlock`, `harmonizeConcept`, `harmonizeDataset`, `buildRefMaps`, `extractInlineRefs`)

### Remaining (future work)
- Add `bin` entry to package.json for CLI wrapper
- Create `bin/glossarist-browser.mjs` with subcommands: fetch, generate, build-edges, build
- Refactor scripts into importable modules (`src/pipeline/`)
- Publish to npm as `glossarist-vocabulary-browser`
- Move `datasets.yml` to geolexica.org repo

## Acceptance Criteria

- [x] No GCR building code remains (build-gcr.mjs, package-dataset.mjs deleted)
- [x] No harmonization code remains in fetch-datasets.mjs
- [x] `build-gcr` and `build-gcr:all` scripts removed from package.json
- [x] `npm run dev` still works for local development
- [x] `npm run fetch-datasets` still works (download GCR + clone fallback)
- [ ] `npx glossarist-browser fetch --config datasets.yml` works (future)
- [ ] Published on npm as `glossarist-vocabulary-browser` (future)
