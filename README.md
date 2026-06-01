# Glossarist Concept Browser

A statically deployable single-page application for browsing terminology datasets. Built with Vue 3, TypeScript, and Tailwind CSS. Add new datasets with zero code changes — just configure `site-config.yml`.

**Live sites:**
- [GeoLexica](https://www.geolexica.org) — IEC Electropedia + ISO/TC 211 + more
- [VIML](https://metanorma.github.io/oiml-viml/) — OIML International Vocabulary of Legal Metrology
- [OIML Terms](https://metanorma.github.io/oiml-terms/) — OIML G 18 terminology

---

## Features

- **Multi-dataset browsing** — Concepts from multiple terminology registers in one place
- **Full multilingual support** — Definitions, notes, and examples in all available languages with i18n UI
- **Concept history timeline** — Review dates, decisions, and change notes per language
- **Cross-reference graph** — D3 force-directed graph showing concept relationships with dataset filtering
- **Rich sidebar provenance** — Publication reference, owner, status, concept/language counts from manifest data
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
  generate   Convert harmonized YAML concepts to JSON-LD static files
  edges      Build cross-reference edges from generated concept data
  build      Full pipeline: fetch + generate + edges + vite build
  site       Same as build (alias)

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
          └─> scripts/generate-data.mjs (YAML → JSON-LD)
              └─> public/data/{id}/
                  ├── manifest.json      Dataset metadata (ref, owner, stats)
                  ├── index.json         Concept listing (chunked for large sets)
                  ├── edges.json         Pre-computed cross-reference + domain edges
                  ├── domain-nodes.json  Domain classification nodes
                  └── concepts/*.json    Individual concept documents
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
| `color` | no | Hex color for UI accent. Auto-assigned if omitted |
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

---

## Architecture

### Tech Stack

- **Vue 3** + **TypeScript** + **Vite**
- **Pinia** (state management)
- **Vue Router** (SPA navigation)
- **Tailwind CSS 3** (utility-first styling)
- **D3.js** (force-directed graph)
- **KaTeX** (math rendering)

### Project structure

```
src/
├── adapters/          Data access layer (DatasetAdapter, AdapterFactory, UriRouter)
├── components/        Vue components (AppSidebar, AppFooter, ConceptDetail, GraphPanel, etc.)
├── graph/             Graph engine for concept relationships
├── stores/            Pinia stores (vocabulary, ui)
├── views/             Page-level components (HomeView, DatasetView, ConceptView, etc.)
├── i18n/              Internationalization (YAML locale files, auto-discovered)
├── utils/             Utilities (math rendering, language names, dataset styling)
└── style.css          Global styles and Tailwind layers

cli/
└── index.mjs          CLI entry point (fetch, generate, edges, build commands)

scripts/
├── fetch-datasets.mjs Clone + harmonize source repos, resolve localPath/GCR
├── generate-data.mjs  Convert YAML → JSON-LD, generate manifest with provenance data
├── build-edges.js     Extract cross-reference edges
└── generate-404.js    SPA fallback for GitHub Pages
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
```

---

## License

This project is part of the [Glossarist](https://github.com/glossarist) ecosystem.
