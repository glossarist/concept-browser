# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glossarist Concept Browser (`@glossarist/concept-browser`) — a Vue 3 SPA that browses ISO terminology datasets. Concepts are stored as static JSON files served from `public/data/` and loaded client-side. No backend server; all data is pre-built and fetched at runtime. Designed to support any number of Glossarist datasets — add a new entry to `datasets.yml` to include a new dataset. No code changes required.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Type-check with vue-tsc, then build for production (includes postbuild 404.html generation)
- `npm run preview` — Preview production build locally
- `npm test` or `npm run test` — Run tests once (vitest)
- `npm run test:watch` — Run tests in watch mode
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

- **Adapters** (`src/adapters/`) — Data access layer. `DatasetAdapter` handles manifest loading, index parsing (with chunked index support for large datasets), concept fetching with caching, search, and edge extraction from pre-computed `gl:references`. `AdapterFactory` is a singleton that discovers and manages adapters. `UriRouter` maps concept URIs to register/concept-id pairs (also provides `parseUri()` static for URI parsing without registration). `ReferenceResolver` provides unified resolution for URIs, URNs, and prefixed refs through a single `Resolution` type (`internal | external | unresolved`).

- **Graph Engine** (`src/graph/GraphEngine.ts`) — Directed multigraph for concept relationships. Supports cross-register edges with correct register derivation from URIs, edge deduplication, stub node creation with auto-upgrade, BFS subgraph extraction, and forward/reverse adjacency. Used by the vocabulary store and rendered in `GraphPanel`/`GraphView` via D3.

- **Config** (`src/config/`) — `SiteConfig` model and `useSiteConfig()` composable for domain-based multi-tenant branding. Reads `site-config.json` at runtime, filters datasets and applies branding per hostname.

- **Stores** (Pinia) — `vocabulary` store is the central data orchestrator: manages dataset lifecycle, seeds graph nodes from index entries, extracts edges from concept documents, and handles URI-based navigation. `ui` store holds sidebar state, selected language, and search query.

- **Router** — Vue Router with routes: `/` (home), `/dataset/:registerId`, `/dataset/:registerId/concept/:conceptId`, `/search`, `/graph`, `/resolve/:uri(.*)` (universal deep-link). Uses `import.meta.env.BASE_URL` for GitHub Pages deployment.

- **Views/Components** — Standard Vue 3 SFC structure. Views are in `src/views/`, reusable components in `src/components/`.

### URI Scheme and Resolution
Concepts use URIs like `https://glossarist.org/{registerId}/concept/{conceptId}`. Resolution flows through `AdapterFactory.resolve()` → `ReferenceResolver.resolveUri()` → `UriRouter`. URNs (`urn:iso:std:iso:NNNN:id`) and prefixed refs (`IEV:xxx`) are resolved via `urnStandardMap` and `refPrefixMap` from manifest data. External references resolve to configurable URL templates. The `/resolve/{uri}` route provides universal concept deep-linking.

### Dataset Styling
Each dataset gets a dynamic color from its `manifest.json` `color` field (set via `datasets.yml`). Colors are used via `useDsStyle()` composable with per-register caching. No hardcoded per-dataset CSS classes — all dataset colors are data-driven.

### Content Rendering
`src/utils/content-renderer.ts` is the single source of truth for ALL inline content rendering. Pipeline stages (in order): math placeholders (`stem:`, `latexmath:`), AsciiDoc tables, lists, text formatting (bold/italic/subscript), bibliography cross-refs, figure refs, URN inline refs, and the mention dispatcher (cite-ref, numeric, two-arg concept refs via `parseMention` from glossarist). `renderContent()` is a pure function accepting `RenderOptions` — no module-level state. `cleanContent()` strips all notation to plain text. `math.ts` re-exports for backward compat only — new code imports from `content-renderer.ts`.

## Tech Stack

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS 3 + D3.js + KaTeX + Vitest (with happy-dom)

## Deployment

Deployed to https://www.geolexica.org via GitHub Pages. CI/CD pipeline: `.github/workflows/deploy.yml` runs fetch-datasets, generate-data, build-edges, build on push to main. SPA fallback via `dist/404.html`.

## Release Rules

- **ALWAYS bump PATCH version only** (e.g. 0.4.9 → 0.4.10). Never bump minor or major unless explicitly requested.
- After any code change, bump patch, tag (`v0.4.X`), push tag to trigger npm release, then redeploy all site repos.
