# Glossarist Concept Browser

A statically deployable single-page application for browsing terminology datasets. Built with Vue 3, TypeScript, and Tailwind CSS. Add new datasets with zero code changes — just configure `site-config.yml`.

**Live sites:**
- [GeoLexica](https://www.geolexica.org) — IEC Electropedia + ISO/TC 211 + more
- [VIML](https://www.oimlsmart.org/vocab/) — OIML International Vocabulary of Legal Metrology
- [OIML Terms](https://metanorma.github.io/oiml-terms/) — OIML G 18 terminology

---

## Features

- **Multi-dataset browsing** — Concepts from multiple terminology registers in one place
- **Full multilingual support** — Definitions, notes, and examples in all available languages with i18n UI
- **Concept history timeline** — Review dates, decisions, and change notes per language
- **Relation sphere** — 3D sphere visualization of a concept's neighborhood with d3 force simulation, per-relation-type colors, and degree filtering
- **Edition series** — Sidebar timeline for vocabulary edition groups (e.g. VIML 1968/2000/2013/2022) with current-edition markers and supersession chain navigation
- **Cross-reference graph** — D3 force-directed graph showing concept relationships with dataset filtering
- **Dataset groups** — Organize datasets into lineage series, topic bundles, publication families, or curated collections. Each group kind has distinct sidebar rendering
- **Light/dark mode colors** — Per-dataset `{ light, dark }` color pairs. Per-relation-type colors configurable via site-config
- **RDF / SHACL outputs** — Every concept emits SHACL-conformant Turtle + JSON-LD. Dataset-level `dcat:Dataset`, group-level `dcat:DatasetSeries`/`dcat:Catalog`, vocabulary SKOS ConceptSchemes, bibliography `dcterms:BibliographicResource`, build provenance `prov:Activity`
- **Rich sidebar provenance** — Publication reference, owner, status, concept/language counts, sections tree from manifest data
- **Math rendering** — KaTeX rendering for AsciiMath notation in definitions (`stem:[...]`)
- **Responsive design** — Mobile-first layout with light/dark mode
- **Static deployment** — No server required. Deploy to any static host

---

## Quick Start (deployment repo)

A deployment repo is a separate repository that provides a `site-config.yml`, dataset source files, and content pages. The concept-browser is installed as an npm package.

```bash
# In your deployment repo:
npm install --ignore-scripts @glossarist/concept-browser
npm install --prefix node_modules/@glossarist/concept-browser sharp 2>/dev/null || true
npx concept-browser build
```

The CLI reads `site-config.yml` from the working directory, fetches/generates data, and builds the SPA into `dist/`.

### Quick Start (development)

```bash
git clone https://github.com/glossarist/concept-browser.git
cd concept-browser
npm install
npm run dev
# Open http://localhost:5173
```

The dev server serves pre-built data from `public/data/`. If no data is present yet, run the data pipeline first (see below).

---

## CLI Reference

```
concept-browser <command> [options]

Commands:
  fetch      Fetch/update datasets (from GCR packages, local paths, or source repos)
  generate   Convert harmonized YAML concepts to JSON-LD static files + RDF artifacts
  edges      Build cross-reference edges from generated concept data
  build      Full pipeline: fetch + generate + edges + vite build
  site       Same as build (alias)
  doctor     Run diagnostic checks (node version, deps, shapes, data integrity)
  normalize  NFC-normalize YAML concept files in-place

Options:
  --site <id>  Site config ID (looks for site-config.yml in CWD)

Environment:
  SITE_CONFIG    Site config file path (highest priority)
  SITE_ID        Site config ID (same as --site)
  GITHUB_TOKEN   GitHub token for private repos
```

---

## Data Pipeline

```
site-config.yml
  └─> scripts/fetch-datasets.mjs       (fetch from GCR, localPath, or sourceRepo)
      └─> .datasets/{id}/concepts/*.yaml
          └─> scripts/generate-data.mjs (YAML → JSON-LD + RDF artifacts)
              └─> public/data/{id}/
                  ├── manifest.json      Dataset metadata (ref, owner, stats)
                  ├── index.json         Concept listing (chunked for large sets)
                  ├── edges.json         Pre-computed cross-reference + domain edges
                  ├── domain-nodes.json  Domain classification nodes
                  ├── {register}.ttl     Dataset-level RDF (dcat:Dataset + skos:ConceptScheme + sections)
                  ├── bib.ttl            Bibliography graph (dcterms:BibliographicResource)
                  └── concepts/*.json    Individual concept documents
              └─> public/data/_vocab.ttl    Vocabulary graph (SKOS ConceptSchemes)
              └─> public/data/activity/    Build provenance (prov:Activity per build)
              └─> public/data/agents.ttl   Contributor records (foaf:Person)
              └─> public/data/versions.ttl Version chain (prov:Entity)
          └─> scripts/build-edges.js    (extract graph + domain edges)
```

---

## Configuration: `site-config.yml`

All configuration lives in a single file. The CLI reads it from the current working directory.

### Top-level fields

```yaml
id: viml                                # Site identifier
domain: viml.oiml.info                  # Primary domain
basePath: /oiml-viml/                   # URL subpath for GitHub Pages deployment
title: VIML                             # Site title
subtitle: International Vocabulary...   # Short description
description: Terminology from...        # Longer description

uiLanguages:                            # Available UI languages
  - code: eng
    label: English
  - code: fra
    label: Français

translations:                           # Localized title/subtitle/description
  fra:
    subtitle: Vocabulaire international de métrologie légale
    description: Terminologie du Vocabulaire international...

defaults:
  language: eng                         # Default concept language

copyright: "OIML"                       # Footer copyright text
```

### Dataset configuration

```yaml
datasets:
  - id: viml
    uri: "urn:oiml:pub:v:1:2022"
    sourceRepo: https://github.com/metanorma/oiml-viml
    localPath: viml-glossarist          # Local dataset directory (relative to CWD)
    title: "VIML — International Vocabulary of Legal Metrology"
    description: "Terminology definitions from..."
    owner: OIML
    ref: "OIML V 1:2022"               # Publication reference (shown in sidebar provenance)
    color: "#004996"
    tags: [metrology, legal, oiml]
    languageOrder: [eng, fra]
```

#### Dataset field reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | URL-safe identifier used in routes and data paths |
| `uri` | no | URI pattern for this dataset |
| `sourceRepo` | no | Git repository URL containing concept YAML files |
| `gcrPackage` | no | URL to a pre-built `.gcr` ZIP archive (alternative to sourceRepo) |
| `localPath` | no | Local directory with `concepts/` and `register.yaml` (relative to CWD) |
| `title` | no | Display name. Falls back to `register.yaml` name field |
| `description` | no | Shown on home page and about page |
| `owner` | no | Organization name shown in sidebar provenance |
| `ref` | no | Publication reference shown in sidebar provenance (e.g., "OIML V 1:2022") |
| `color` | no | Accent color — single hex (`"#004996"`) or `{ light, dark }` pair |
| `tags` | no | Array of labels shown on dataset card |
| `languageOrder` | no | Array of ISO 639-2 codes controlling display order |
| `translations` | no | Localized title and description per language |

#### Dataset source resolution

The CLI resolves dataset sources in this priority order:

1. **`.gcr/{id}.gcr`** on disk — extract to `.datasets/{id}/`
2. **`gcrPackage`** URL — download and extract
3. **`localPath`** — copy `concepts/` and `register.yaml` from a local directory
4. **`sourceRepo`** — git clone to `.datasets/{id}/`

### Base path for subpath deployment

Set `basePath` in `site-config.yml` to deploy to a subdirectory (e.g., GitHub Pages at `metanorma.github.io/my-site/`):

```yaml
basePath: /my-site/
```

This configures Vite's `base` so all asset paths, router paths, and data fetches use the correct prefix. The `BASE_PATH` environment variable can override this if needed.

### Branding and favicon

```yaml
branding:
  primaryColor: "#004996"
  darkColor: "#003366"
  fonts:
    header:
      family: "Source Serif 4"
      source: "google"
      weights: [400, 600]
    body:
      family: "Source Sans 3"
      source: "google"
      weights: [400, 500, 700]
  logo:
    path: /logos/oiml-logo.svg          # URL path served to browsers
    alt: OIML
    localPath: logos/oiml-logo.svg       # Local file for favicon generation
    localLight: logos/oiml-logo-icon-light.svg   # Light variant (dark mode)
    localDark: logos/oiml-logo-icon-dark.svg     # Dark variant (light mode)
  ownerName: OIML
  ownerUrl: "https://www.oiml.org"
```

Favicons are auto-generated from the logo SVG using the `favicons` package. Resolution order: `branding.favicon` → `branding.logo.localPath` → package default `public/favicon.svg`.

### Site features

```yaml
features:
  news: false              # enable news posts
  stats: true              # show statistics dashboard
  graph: true              # enable concept graph visualization
  about: true              # enable about page
  search: true             # enable full-text search
  poweredBy:
    title: "Glossarist"
    url: "https://glossarist.org"
```

### Content pages

```yaml
pages:
  - type: about
    route: about
    title: About
    icon: info
    source: about.md
    translations:
      fra:
        title: À propos
        source: about-fra.md
```

### Dataset groups

When a site has many datasets, you can group them in the sidebar navigation. Each group has a `kind` that determines its visual treatment and semantic assumptions.

```yaml
datasetGroups:
  - id: viml
    label: "VIML — International Vocabulary of Legal Metrology"
    kind: lineage                  # edition series (same vocabulary, different years)
    current: viml-2022             # current edition for the series
    color:
      light: "#004996"
      dark: "#3B82F6"
    datasets: [viml-2022, viml-2013, viml-2000, viml-1968]
    translations:
      fra:
        label: "VIML — Vocabulaire international de métrologie légale"

  - id: vim
    label: "VIM — International Vocabulary of Metrology"
    kind: lineage
    current: vim-2012
    color:
      light: "#005A9C"
      dark: "#2196F3"
    datasets: [vim-2012, vim-2010, vim-2007, vim-1993]
```

#### Group kinds

| Kind | Glyph | Description | Sidebar rendering |
|------|-------|-------------|-------------------|
| `lineage` | ⏳ | Editions of the same vocabulary over time | Compact timeline with year badges + current-edition star (✦) |
| `topic` | ◆ | Different vocabularies on the same subject | Standard list entries |
| `family` | ✦ | Related vocabularies from the same publisher | Standard list entries |
| `collection` | ❖ | Curated bundle of datasets | Standard list entries |
| `default` | ▸ | No special semantics (backward compat) | Standard list entries |

For `lineage` groups:
- The `current` field identifies the newest valid edition. If omitted, the newest member by year is auto-detected.
- Members are displayed as a timeline with year + reference + status badges.
- When an edition is active, the full expansion (sub-pages, sections tree, provenance) appears below the timeline entry — same as non-series datasets.
- A supersession chain card (`ConceptEditionRail`) appears in the concept detail sidebar, showing how the concept evolved across editions.

#### Group field reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique identifier for the group |
| `label` | yes | Display name shown as the collapsible group header |
| `kind` | no | Group kind: `lineage`, `topic`, `family`, `collection`, `default`. Defaults to `default` |
| `current` | no | For `lineage`: dataset id of the current (newest valid) edition |
| `description` | no | Short description of the group |
| `color` | no | Accent color — single hex or `{ light, dark }` pair |
| `datasets` | yes | Ordered array of dataset IDs belonging to this group |
| `translations` | no | Localized label and description per language |

Datasets not assigned to any group appear at the bottom of the dataset list.

### Internationalization

All localized text uses language maps — a `translations` field keyed by ISO 639-2 language codes. The top-level `title` and `description` fields hold the default-language text. The `translations` map provides overrides for additional languages:

```yaml
datasets:
  - id: viml-2022
    title: "OIML V 1:2022"
    description: "Current edition with 135 terms..."
    translations:
      fra:
        title: "OIML V 1:2022"
        description: "Édition actuelle comprenant 135 termes..."

datasetGroups:
  - id: viml
    label: "International Vocabulary of Legal Metrology"
    translations:
      fra:
        label: "Vocabulaire international de métrologie légale"
```

This pattern applies everywhere localized text appears: site-level translations, dataset translations, group translations, and page translations. Do not use language suffixes like `_fra` — use nested language maps instead.

### Color system

Dataset and group colors accept either a single hex string (backward compat) or a `{ light, dark }` pair:

```yaml
# Single hex (applied to both modes)
color: "#004996"

# Explicit light/dark pair
color:
  light: "#004996"
  dark: "#3B82F6"
```

Relationship-type colors default from `data/colors.json` but can be overridden per deployment:

```yaml
colors:
  relationshipType:
    supersedes:
      light: "#FF0000"
      dark: "#FF5555"
  dataset:
    viml-2022:
      light: "#004996"
      dark: "#3B82F6"
```

CSS variables are emitted on document root by `useColorTheme()`:
- `--rel-{category}-{light|dark}` per relationship category
- `--rel-type-{type}-{light|dark}` per relationship type
- `--concept-status-{status}-{light|dark}` per concept status
- `--group-kind-{kind}-{light|dark}` per group kind
- `--ds-{light|dark}` per dataset (scoped via `[data-ds]`)

### Cross-reference mapping

```yaml
crossReferences:
  refPrefixMap:
    IEV: iev
  urnStandardMap:
    "14812": isotc204
```

---

## Deployment

### GitHub Pages (recommended)

1. Create a deployment repo with `site-config.yml`, dataset source, and content pages
2. Add a GitHub Actions workflow:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install concept-browser
        run: |
          npm install --ignore-scripts @glossarist/concept-browser
          npm install --prefix node_modules/@glossarist/concept-browser sharp 2>/dev/null || true
      - name: Build site
        run: npx concept-browser build
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: ${{ github.ref == 'refs/heads/main' }}
    steps:
      - uses: actions/deploy-pages@v4
```

All configuration (base path, dataset sources, branding) comes from `site-config.yml` — no dataset-specific environment variables needed.

### Other hosting platforms

The build produces static files in `dist/` with an SPA `404.html` fallback:

- **Netlify:** Build command `npx concept-browser build`, publish directory `dist`, add `_redirects` with `/* /index.html 200`
- **Vercel:** Framework Vite, build command `npx concept-browser build`, output directory `dist`
- **AWS S3 + CloudFront:** Upload `dist/`, error document `index.html`, configure CloudFront for SPA routing

### Known deployments

Sites currently powered by `@glossarist/concept-browser`. When cutting a release with breaking changes, bump `@glossarist/concept-browser` in each consumer repo and redeploy.

| Repo | Site |
|---|---|
| [`geolexica/geolexica.github.io`](https://github.com/geolexica/geolexica.github.io) | https://www.geolexica.org |
| [`geolexica/isotc204.geolexica.org`](https://github.com/geolexica/isotc204.geolexica.org) | https://isotc204.geolexica.org |
| [`geolexica/isotc211.geolexica.org`](https://github.com/geolexica/isotc211.geolexica.org) | https://isotc211.geolexica.org |
| [`geolexica/osgeo.geolexica.org`](https://github.com/geolexica/osgeo.geolexica.org) | https://osgeo.geolexica.org |
| [`oimlsmart/vocab`](https://github.com/oimlsmart/vocab) | https://www.oimlsmart.org/vocab/ (VIML)¹ |
| [`metanorma/oiml-terms`](https://github.com/metanorma/oiml-terms) | https://metanorma.github.io/oiml-terms/ |
| [`metanorma/iala-vocab`](https://github.com/metanorma/iala-vocab) | https://metanorma.github.io/iala-vocab/ |
| [`metanorma/iso-10303-2-vocab`](https://github.com/metanorma/iso-10303-2-vocab) | https://metanorma.github.io/iso-10303-2-vocab/ |

To add a new deployment here, open a PR against this README.

¹ The VIML deployment moved from `metanorma/oiml-viml` to [`oimlsmart/vocab`](https://github.com/oimlsmart/vocab) (GitHub redirects the old name automatically), and its live URL moved from `metanorma.github.io/oiml-viml/` to `www.oimlsmart.org/vocab/`. The old `metanorma.github.io/oiml-viml/` URL returns 404 (Pages doesn't follow repo renames across orgs).

---

## Architecture

### Tech Stack

- **Vue 3** + **TypeScript** + **Vite**
- **Pinia** (state management)
- **Vue Router** (SPA navigation)
- **Tailwind CSS 3** (utility-first styling)
- **D3.js** (force-directed graph + relation sphere)
- **KaTeX** (math rendering)
- **n3** + **rdf-validate-shacl** (RDF parsing + SHACL validation)
- **fast-check** (property-based fuzz testing)
- **Vitest** with happy-dom

### Project structure

```
src/
├── adapters/          Data access layer (DatasetAdapter, AdapterFactory, UriRouter)
├── components/        Vue components (AppSidebar, ConceptDetail, RelationSphere, etc.)
│   ├── concept-rdf/   RDF graph IR + emitters + writers (concept, dataset, group, vocab, etc.)
│   └── groups/        OCP group renderer dispatcher + per-kind sidebar components
├── composables/       Vue composables (useDatasetSeries, useColorTheme, useSphereProjection)
├── config/            Site config types, group-types registry, group-renderers registry
├── data/              Static data (taxonomies.json, colors.json, concept-model shapes)
├── graph/             Graph engine for concept relationships
├── stores/            Pinia stores (vocabulary, ui)
├── views/             Page-level components (HomeView, DatasetView, ConceptView, GroupView)
├── i18n/              Internationalization (YAML locale files, auto-discovered)
└── utils/             Utilities (color-theme, dataset-style, relationship-categories, content-renderer)

cli/
└── index.mjs          CLI entry point (fetch, generate, edges, build, doctor, normalize)

scripts/
├── fetch-datasets.mjs       Clone + harmonize source repos
├── generate-data.mjs        Convert YAML → JSON-LD + RDF artifacts
├── build-edges.js           Extract cross-reference edges
├── process-about-pages.mjs  Compile markdown/AsciiDoc about pages
├── validate-shacl.mjs       SHACL validation gate
└── lib/                     Build-time emitters (vocab, dataset, group, agents, version, etc.)
```

---

## i18n

UI translations are YAML files in `src/i18n/locales/`, auto-discovered via `import.meta.glob`. To add a new language:

1. Copy `eng.yml` to `{lang-code}.yml`
2. Translate all values
3. Add the language to `uiLanguages` in `site-config.yml`

---

## Testing

```bash
npm test              # Run all tests (Vitest with happy-dom)
npm run test:watch    # Watch mode
npm run mutation:test # Stryker mutation testing (scoped to RDF emitters, ~3-5 min)
```

Test coverage includes:
- 1357+ tests across unit, round-trip, SHACL conformance, property-based fuzz, and build-integration layers
- 7-fixture concept corpus (minimal, multilingual, full-relationships, with-sources, with-non-verbal, with-dates, withdrawn)
- SHACL conformance gate: all fixtures validated against canonical shapes
- Property-based fuzz: 200 iterations × 4 invariants via fast-check
- 10,000-concept scale stress test (< 100ms)
- Stryker mutation testing scoped to concept/dataset/bibliography emitters

---

## License

This project is part of the [Glossarist](https://github.com/glossarist) ecosystem.
