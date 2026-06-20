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
- `npm run check:scripts` — Syntax-gate every `.mjs`/`.js`/`.cjs` file under `scripts/` and `cli/` via `node --check`. Also runs automatically via the `pretest` and `prebuild` hooks, and as an explicit CI step before `npm test`. Prevents regressions like v0.7.45 where `await` was used inside a non-async function in `scripts/generate-data.mjs` (a file vitest never imports and vue-tsc never type-checks).
- Run a single test: `npx vitest run src/__tests__/graph.test.ts`
- `npm run fetch-datasets` — Clone/update source repos into `.datasets/`, harmonize concepts to canonical format. Supports `DATASET_SOURCE_{ID}` env var for local path override.
- `npm run generate-data` — Convert harmonized YAML concepts to JSON-LD. Reads from `.datasets/` (populated by fetch-datasets) and `datasets.yml`.
- `node scripts/build-edges.js` — Pre-compute cross-reference and domain edges from generated concept JSON files, writes `edges.json` + `domain-nodes.json` (run after `generate-data`)
- `npm run build:full` — Full pipeline: fetch + generate + build-edges + build
- `npx concept-browser <command>` — CLI: fetch, generate, edges, build

## Architecture

### Data Pipeline
Source repos (listed in `datasets.yml`) → `scripts/fetch-datasets.mjs` (clone + harmonize to canonical format) → `.datasets/{id}/concepts/*.yaml` → `scripts/generate-data.mjs` (canonical YAML → JSON-LD) → static files in `public/data/{id}/`. Cross-reference extraction happens in two places: inline refs (`{{term, IEV:xxx}}` and `{urn:iso:std:iso:NNNN:x.x.x.x,term}`) are extracted during harmonization and stored as `references` in the YAML. The `build-edges.js` script reads `gl:references` from generated JSON-LD.

### Canonical Concept Format
All datasets are harmonized to ONE canonical YAML format before `generate-data.mjs` processes them. See `docs/dataset-schema.md` for the full specification. Key rules: definitions always `[{content: "text"}]`, sources always an array, `entry_status` normalized to `valid`/`supersected`/`withdrawn`/`draft`. No format-variant handling in `generate-data.mjs`.

### GCR Packaging Format
The target architecture uses GCR (Glossarist Concept Repository) files — sealed ZIP archives with harmonized concepts + metadata, modeled after LXR from `lutaml-xsd`. See `docs/gcr-spec.md`. Currently, the browser reads from cloned repos; when the glossarist gem provides `glossarist package`, the pipeline will switch to consuming `.gcr` files.

### Data Flow
`public/datasets.json` → lists dataset IDs → each maps to `public/data/{id}/` containing `manifest.json`, `index.json`, `edges.json` (cross-reference + domain edges), `domain-nodes.json` (domain classification nodes with concept counts), and `concepts/*.json`. The `AdapterFactory` discovers datasets at startup, loads manifests and indexes, then concepts are fetched on-demand when a user navigates to one.

### Key Layers

- **Adapters** (`src/adapters/`) — Data access layer. `DatasetAdapter` handles manifest loading, index parsing (with chunked index support for large datasets), concept fetching with caching, search, edge extraction from pre-computed `gl:references`, and designation-based concept lookup (`lookupByDesignation`). `AdapterFactory` is a singleton that discovers and manages adapters. `UriRouter` (SSOT for URI routing) maps concept URIs to register/concept-id pairs with wildcard pattern matching and URN prefix mapping. `ReferenceResolver` provides unified resolution for URIs, URNs, and prefixed refs through a single `Resolution` type (`internal | external | unresolved`), delegating URI pattern matching to `UriRouter`.

- **Graph Engine** (`src/graph/GraphEngine.ts`) — Directed multigraph for concept relationships. Supports cross-register edges with correct register derivation from URIs, edge deduplication, stub node creation with auto-upgrade, BFS subgraph extraction, and forward/reverse adjacency. Used by the vocabulary store and rendered in `GraphPanel`/`GraphView` via D3.

- **Config** (`src/config/`) — `SiteConfig` model and `useSiteConfig()` composable for domain-based multi-tenant branding. Reads `site-config.json` at runtime, filters datasets and applies branding per hostname.

- **Stores** (Pinia) — `vocabulary` store is the central data orchestrator: manages dataset lifecycle, seeds graph nodes from index entries, extracts edges from concept documents, and handles URI-based navigation. `ui` store holds sidebar state, selected language, and search query.

- **Router** — Vue Router with routes: `/` (home), `/dataset/:registerId`, `/dataset/:registerId/concept/:conceptId`, `/search`, `/graph`, `/resolve/:uri(.*)` (universal deep-link). Uses `import.meta.env.BASE_URL` for GitHub Pages deployment.

- **Views/Components** — Standard Vue 3 SFC structure. Views are in `src/views/`, reusable components in `src/components/`.

### Hierarchical Sections
Registers can define hierarchical sections in `register.yaml` using the `children` field. The section tree is serialized verbatim into `manifest.sections` by `generate-data.mjs` — it is the single source of truth for hierarchy at runtime.

- **Build (`scripts/lib/concept-groups.mjs`):** `getGroups(conceptYaml)` produces a concept's direct section memberships. No parent inflation.
- **Runtime (`src/utils/section-tree.ts`):** pure helpers — `findSectionNode`, `collectDescendantSectionIds`, `toSectionNode`, `toSectionTree`.
- **Filtering (`src/views/DatasetView.vue`):** `sectionClosure` computed builds the descendant closure once per filter change; `conceptMatchesSection` intersects each concept's `groups` with the closure. Arbitrary depth works.
- **Display (`src/utils/section-display.ts`):** `formatSectionLabel` is the single source for the "id — name" disambiguation rule.

### URI Scheme and Resolution
Concepts use URIs like `https://glossarist.org/{registerId}/concept/{conceptId}`. Resolution flows through `AdapterFactory.resolve()` → `ReferenceResolver.resolveUri()` → `UriRouter`. URNs (`urn:iso:std:iso:NNNN:id`) and prefixed refs (`IEV:xxx`) are resolved via `urnStandardMap` and `refPrefixMap` from manifest data. External references resolve to configurable URL templates. The `/resolve/{uri}` route provides universal concept deep-linking.

### Dataset Styling
Each dataset gets a dynamic color from its `manifest.json` `color` field (set via `datasets.yml`). Colors are used via `useDsStyle()` composable with per-register caching. No hardcoded per-dataset CSS classes — all dataset colors are data-driven.

### Content Rendering
`src/utils/content-renderer.ts` is the single source of truth for ALL inline content rendering. Pipeline stages (in order): math placeholders (`stem:`, `latexmath:`), AsciiDoc tables, lists, text formatting (bold/italic/subscript), bibliography cross-refs, figure refs, URN inline refs, and the mention dispatcher (cite-ref, urn-ref, numeric, designation, two-arg concept refs via `parseMention` from glossarist ≥ 0.3.7). Mention convention: **ID always first, render term last** — `{{concept_id, display_text}}`. `renderContent()` is a pure function accepting `RenderOptions` (includes `xrefResolver`, `bibResolver`, `figResolver`, `conceptRefResolver`, `citeResolver`, `urnRefResolver`) — no module-level state. `cleanContent()` strips all notation to plain text. `math.ts` re-exports for backward compat only — new code imports from `content-renderer.ts`.

### Designation Lookup
`DatasetAdapter` builds a `designationMap` (lowercase designation → concept ID) during `buildSummaryIndex()`. The `lookupByDesignation()` method enables the runtime `conceptRefResolver` to resolve `{{atomic data unit, atomic data units}}` mentions to the actual concept ID `express-language.atomic_data_unit` — without this, designation-based cross-references would not link.

## Tech Stack

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS 3 + D3.js + KaTeX + Vitest (with happy-dom)

## Deployment

Deployed to https://www.geolexica.org via GitHub Pages. CI/CD pipeline: `.github/workflows/deploy.yml` runs fetch-datasets, generate-data, build-edges, build on push to main. SPA fallback via `dist/404.html`.

## Release Rules

- **ALWAYS bump PATCH version only** (e.g. 0.7.41 → 0.7.42). Never bump minor or major unless explicitly requested.
- **Release (Patch) workflow** (`.github/workflows/release-patch.yml`): manually triggered via GitHub Actions UI. Bumps version, runs tests, commits, tags, pushes to main, then triggers `release.yml` via `workflow_dispatch`. The `release.yml` workflow performs the npm publish with provenance (OIDC trusted publishing — no `NPM_TOKEN` needed) and creates a GitHub Release.
- After release, bump `@glossarist/concept-browser` in every consumer repo listed in **README § Known deployments** and merge through their normal PR flow. The current consumers are `geolexica/geolexica.github.io`, `geolexica/isotc204.geolexica.org`, `geolexica/isotc211.geolexica.org`, `geolexica/osgeo.geolexica.org`, `oimlsmart/vocab`, `metanorma/oiml-terms`, `metanorma/iala-vocab`, `metanorma/iso-10303-2-vocab`. Keep the two lists in sync — README is the source of truth.
