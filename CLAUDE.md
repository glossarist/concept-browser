# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glossarist Concept Browser (`@glossarist/concept-browser`) — a Vue 3 SPA that browses ISO terminology datasets. Concepts are stored as static JSON files served from `public/data/` and loaded client-side. No backend server; all data is pre-built and fetched at runtime. Designed to support any number of Glossarist datasets — add a new entry to `datasets.yml` to include a new dataset. No code changes required.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Type-check with vue-tsc, then build for production (includes postbuild 404.html generation)
- `npm run preview` — Preview production build locally
- `npm test` or `npm run test` — Run tests once (vitest). Runs `pretest` first, which executes the script syntax gate.
- `npm run test:watch` — Run tests in watch mode
- `npm run check:scripts` — Syntax-gate every `.mjs`/`.js`/`.cjs` file under `scripts/` and `cli/`
- `npm run mutation:test` — Run stryker mutation testing (scoped to RDF emitters, ~3-5 min)
- Run a single test: `npx vitest run src/__tests__/graph.test.ts`
- `npm run fetch-datasets` — Clone/update source repos into `.datasets/`, harmonize concepts to canonical format
- `npm run generate-data` — Convert harmonized YAML concepts to JSON-LD + RDF artifacts
- `node scripts/build-edges.js` — Pre-compute cross-reference and domain edges
- `npm run build:full` — Full pipeline: fetch + generate + build-edges + build
- `npx concept-browser <command>` — CLI: fetch, generate, edges, build, doctor, normalize
- `node scripts/process-about-pages.mjs` — Compile markdown/AsciiDoc about pages for datasets and groups

## Architecture

### Data Pipeline
Source repos (listed in `datasets.yml`) → `scripts/fetch-datasets.mjs` → `.datasets/{id}/concepts/*.yaml` → `scripts/generate-data.mjs` → static files in `public/data/{id}/`. The generator now emits additional RDF artifacts: `_vocab.ttl` (vocabulary graph), `{register}.ttl` (dataset-level dcat:Dataset), `activity/{runId}.ttl` (build provenance), `agents.ttl` (contributor records), `versions.ttl` (version chain), `bib.ttl` (bibliography).

### RDF Intermediate Representation
`src/components/concept-rdf/` contains a graph-based IR that is the single source of truth for all RDF emission. The `ConceptEmitter` walks the Concept model and populates an `RdfGraph`; the Turtle/JSON-LD writers and the UI sections builder all consume the same graph. Key design (ADRs 0001–0009):
- `RdfGraph` — subject-grouped triple store with insertion-order preservation
- `concept-emitter.ts` — walks Concept model → RdfGraph, aligned with canonical SHACL shapes
- `turtle-writer.ts` / `jsonld-writer.ts` — serialize RdfGraph to Turtle or JSON-LD
- `vocabulary-emitter.ts` — emits SKOS ConceptSchemes for enumeration IRIs
- `dataset-emitter.ts` — emits dcat:Dataset + skos:ConceptScheme per register
- `group-emitter.ts` — emits dcat:DatasetSeries (lineage) or dcat:Catalog (topic/family/collection)
- `bibliography-emitter.ts` — emits dcterms:BibliographicResource per entry
- `build-activity-emitter.ts` — emits prov:Activity per build run
- `agents-emitter.ts` — emits foaf:Person / prov:Organization from site-config contributors
- `version-emitter.ts` — emits prov:Entity version chain
- `image-variant-emitter.ts` — emits foaf:Image per format/language variant
- `table-formula-emitter.ts` — emits gloss:Table / gloss:Formula

### SHACL Conformance
All concept fixtures conform to canonical SHACL shapes at `data/concept-model/shapes/glossarist.shacl.ttl`. Layer 4 (`shacl-conformance.test.ts`) is a strict gate — any fixture that doesn't conform fails the build. The shapes file has been extended with K1 shapes: `gloss:NonVerbalEntity`, `gloss:Figure`, `gloss:Table`, `gloss:Formula`, `gloss:ImageShape`, `gloss:NonVerbalRepShape`.

### Color System
`data/colors.json` is the SSOT for all colorable semantic categories (relationship types, concept statuses, group kinds). Each entry has explicit `light` + `dark` variants. Per-deployment overrides via `site-config.json` `colors` block. `useColorTheme()` composable emits CSS custom properties on document root.

Dataset colors accept either a single hex (backward compat) or `{ light, dark }` pair. `useDsStyle()` returns both variants + alpha helpers.

### Dataset Groups
Datasets can be organized into groups via `site-config.json` `datasetGroups`. Each group has a `kind`:
- `lineage` — editions of the same vocabulary (e.g. VIML 1968/2000/2013/2022). Renders as timeline with year badges.
- `topic` — different vocabularies on the same subject. Card grid.
- `family` — related vocabularies from same publisher. Flat list.
- `collection` — curated bundle. Featured cards.
- `default` — flat list, no special semantics.

Group metadata lives in `src/config/group-types.ts` (registry pattern). Renderer dispatch via `src/config/group-renderers.ts` → `DatasetGroupRenderer.vue` (OCP: new kind = one entry + one component).

### Key Layers

- **Adapters** (`src/adapters/`) — `DatasetAdapter`, `AdapterFactory`, `UriRouter` (SSOT for URI routing), `ReferenceResolver`.

- **Graph Engine** (`src/graph/GraphEngine.ts`) — Directed multigraph for concept relationships. Used by the vocabulary store and rendered in `GraphPanel`/`GraphView`/`RelationSphere` via D3.

- **Config** (`src/config/`) — `SiteConfig`, `useSiteConfig()`, `group-types.ts` (group kind registry), `group-renderers.ts` (OCP renderer registry).

- **Stores** (Pinia) — `vocabulary` (data orchestrator), `ui` (sidebar state, selected language, search query, dark mode).

- **Router** — Routes: `/`, `/dataset/:registerId`, `/dataset/:registerId/concept/:conceptId`, `/dataset/:registerId/about`, `/search`, `/graph`, `/group/:groupId`, `/group/:groupId/about`, `/resolve/:uri(.*)`. Concept view mode persisted via `?view=sphere` query param.

- **Views/Components** — `ConceptView` (detail + sphere toggle), `DatasetView` (concept list + series card), `GroupView` (group overview + about page), `AboutView` (structured metadata fallback).

### Hierarchical Sections
Sections in `register.yaml` → `manifest.sections`. Cascading membership via `gloss:hasChildSection` / `gloss:hasParentSection` (owl:TransitiveProperty). Runtime helpers in `src/utils/section-tree.ts`.

### URI Scheme and Resolution
Concepts use URIs like `https://glossarist.org/{registerId}/concept/{conceptId}`. `UriRouter.parseUri()` is the SSOT for concept URI parsing. No hardcoded hostnames.

### Dataset Styling
Each dataset color from `manifest.json` or `site-config.json`. Colors accept `{ light, dark }` pairs. `useDsStyle()` composable with per-register caching. CSS variables emitted by `useColorTheme()` on `:root` and per-dataset `[data-ds]` scopes.

### Content Rendering
`src/utils/content-renderer.ts` — single source of truth for ALL inline content. Pipeline: math → AsciiDoc tables → lists → text formatting → bibliography refs → figure refs → URN refs → mention dispatcher. `renderContent()` is a pure function with `RenderOptions` resolvers.

### Relation Sphere
`RelationSphere.vue` — 3D sphere visualization of a concept's neighborhood. Physics: d3 force simulation with sphere constraint, velocity clamp, and SLERP-eased navigation. Colors sourced from the taxonomy + color-theme SSOTs via `relation-sphere-styling.ts` bridge. View mode toggle (s/d keyboard shortcuts) persisted in URL.

### Vocabulary SSOT
`data/glossarist-vocab.json` — single source for all 50+ relationship types, 4 concept statuses, 4 entry statuses, 3 normative statuses, 12 source statuses, 2 source types, 5 date types. Both TS and mjs emitters consume this file. Relationship labels come from `src/data/taxonomies.json` via `relationshipLabel()` — no duplicate i18n keys.

## Tech Stack

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS 3 + D3.js + KaTeX + n3 + rdf-validate-shacl + fast-check + Vitest (with happy-dom)

## Deployment

Deployed to https://www.geolexica.org via GitHub Pages. CI/CD pipeline: `.github/workflows/deploy.yml` runs fetch-datasets, generate-data, build-edges, build on push to main. SPA fallback via `dist/404.html`.

## Release Rules

- **ALWAYS bump PATCH version only** (e.g. 0.7.41 → 0.7.42). Never bump minor or major unless explicitly requested.
- **Release (Patch) workflow** — manually triggered via GitHub Actions UI.
- After release, bump `@glossarist/concept-browser` in every consumer repo listed in **README § Known deployments**.
