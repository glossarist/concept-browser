# Glossarist Vocabulary Browser

A statically deployable single-page application for browsing ISO/IEC terminology datasets. Built with Vue 3, TypeScript, and Tailwind CSS. Add new datasets with zero code changes — just edit `datasets.yml`.

**Live site:** <https://www.geolexica.org>

Glossarist is the software; deployment to `www.geolexica.org` happens through the [geolexica.org](https://github.com/geolexica/geolexica.org) repository, which sources the built SPA and deploys via S3 + CloudFront.

---

## Features

- **Multi-dataset browsing** — Concepts from multiple terminology registers in one place
- **Full multilingual support** — Definitions, notes, and examples in all available languages
- **Concept history timeline** — Review dates, decisions, and change notes per language
- **Cross-reference graph** — D3 force-directed graph showing concept relationships with dataset filtering
- **Math rendering** — KaTeX rendering for AsciiMath notation in definitions (`stem:[...]`)
- **Responsive design** — Mobile-first layout with integrated navigation
- **Static deployment** — No server required. Deploy to any static host

---

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
```

The dev server serves pre-built data from `public/data/`. If no data is present yet, run the data pipeline first (see below).

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Type-check (`vue-tsc`) + Vite build + generate `404.html` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run tests (Vitest with happy-dom) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run fetch-datasets` | Clone/update source repos, harmonize concepts to canonical YAML |
| `npm run generate-data` | Convert harmonized YAML → JSON-LD static files |
| `npm run build:full` | Full pipeline: fetch + generate + build-edges + build |

---

## Data Pipeline

```
datasets.yml
  └─> scripts/fetch-datasets.mjs   (clone + harmonize)
      └─> .datasets/{id}/concepts/*.yaml
          └─> scripts/generate-data.mjs  (YAML → JSON-LD)
              └─> public/data/{id}/
                  ├── manifest.json      Dataset metadata
                  ├── index.json         Concept listing (chunked for large sets)
                  ├── edges.json         Pre-computed cross-reference + domain edges
                  ├── domain-nodes.json  Domain classification nodes
                  └── concepts/*.json    Individual concept documents
          └─> scripts/build-edges.js  (extract graph + domain edges)
```

### Step-by-step

```bash
# 1. Fetch source repos and harmonize concepts
npm run fetch-datasets

# 2. Generate static JSON-LD data files
npm run generate-data

# 3. Pre-compute cross-reference edges
node scripts/build-edges.js

# 4. Build the SPA
npm run build
```

Or use the single-command pipeline:

```bash
npm run build:full
```

### Local dataset override

To use a local checkout instead of cloning from GitHub:

```bash
DATASET_SOURCE_IEV=/path/to/local/iev-data npm run fetch-datasets
```

Replace `IEV` with the uppercase dataset ID.

---

## Configuration: `datasets.yml`

All dataset configuration lives in a single file. Adding a new dataset requires **zero code changes** — just add an entry to `datasets.yml` and run the pipeline.

### Full reference

```yaml
datasets:
  - id: my-dataset                          # required — URL-safe identifier
    sourceRepo: https://github.com/org/repo  # required — Git repo with concept YAML
    # OR use a pre-built GCR package:
    gcrPackage: https://github.com/org/repo/releases/latest/download/pkg.gcr

    title: "My Glossary"                    # optional — falls back to register.yaml name
    description: "Description of dataset"   # optional — shown on home and about pages
    owner: My Organization                  # optional — shown in badges and about page
    color: "#6366f1"                        # optional — hex color for UI accent (default: auto-assigned)
    tags: [tag1, tag2]                      # optional — shown on dataset card
    existingSiteUrl: https://example.org    # optional — link to existing site for this dataset
    externalConceptUrlTemplate: "https://example.org/concepts/{conceptId}/"  # optional — per-concept external link
    languageOrder: [eng, fra, deu, spa]     # optional — custom language tab ordering
```

### Field details

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | URL-safe identifier used in routes (`/dataset/{id}/concept/...`) and data paths (`public/data/{id}/`) |
| `sourceRepo` | yes* | Git repository URL containing concept YAML files in `concepts/` directory. `gcrPackage` is an alternative. |
| `gcrPackage` | no | URL to a pre-built `.gcr` ZIP archive. Used instead of `sourceRepo` when available. See `docs/gcr-spec.md`. |
| `title` | no | Display name. Falls back to `name` field in the repo's `register.yaml`. |
| `description` | no | Shown on the home page dataset card and the about page. |
| `owner` | no | Organization name shown in concept badges and the about page. |
| `color` | no | Hex color (`#RRGGBB`) for dataset accent. Used for graph nodes, sidebar highlights, and card borders. Auto-assigned if omitted. |
| `tags` | no | Array of short labels shown on the dataset card. |
| `existingSiteUrl` | no | Link to the dataset's existing website, shown as a badge on the dataset page. |
| `externalConceptUrlTemplate` | no | URL template for linking to the official source of each concept. `{conceptId}` is replaced with the concept ID. |
| `languageOrder` | no | Array of ISO 639-2 language codes controlling the display order on concept pages. Without this, languages default to English-first then alphabetical. |

### Cross-reference mapping

The top-level `crossReferences` section maps inline references to dataset IDs:

```yaml
crossReferences:
  refPrefixMap:
    IEV: iev                    # {{term, IEV:xxx}} → glossarist.org/iev/concept/xxx
  urnStandardMap:
    "14812": isotc204            # urn:iso:std:iso:14812:... → isotc204
```

---

## Adding a New Dataset

1. Add an entry to `datasets.yml` (see configuration above)
2. Run `npm run fetch-datasets && npm run generate-data && node scripts/build-edges.js`
3. Verify with `npm run dev`
4. Commit and push

For the full guide, see [Adding a Dataset](docs/adding-a-dataset.md).

### Source repository requirements

The source repository must contain:

- `concepts/` directory with YAML concept files (one per concept)
- Optionally `register.yaml` with dataset metadata

Concepts must conform to the [canonical format](docs/dataset-schema.md). The harmonization step in `fetch-datasets` normalizes common variants automatically.

---

## Included Datasets

| Dataset | Concepts | Languages | Description |
|---------|----------|-----------|-------------|
| IEC Electropedia (IEV) | 22,228 | 17 | World's most comprehensive electrotechnical terminology database |
| ISO/TC 211 Multi-Lingual Glossary | 1,302 | 5+ | Geographic information terminology |
| ISO/TC 204 ITS Vocabulary | 312 | 1 | Intelligent transport systems terminology |
| OSGeo Lexicon | 444 | 1 | Open Source Geospatial Foundation glossary |

---

## Deployment

### Architecture

```
glossarist/vocabulary-browser          geolexica/geolexica.org
(Glossarist software)                  (Deployment target)
─────────────────────                  ──────────────────────
Push to main                           Push to main / repository_dispatch
  │                                      │
  ├─ .github/workflows/deploy.yml       │
  │   fetch + generate + build           │
  │   → deploys to GitHub Pages (preview)│
  │   → triggers geolexica.org dispatch  │
  │                                      │
  └──── repository_dispatch ─────────> build_deploy.yml
                                          checkout vocabulary-browser
                                          fetch + generate + build
                                          → GitHub Pages → www.geolexica.org
```

The vocabulary-browser repository is the **Glossarist software**. The [geolexica.org](https://github.com/geolexica/geolexica.org) repository is the **deployment target** — its workflow checks out vocabulary-browser, builds it, and deploys to GitHub Pages at `www.geolexica.org`.

### Production deployment (www.geolexica.org)

Deployments are managed by the `geolexica.org` repository's `build_deploy.yml` workflow:

1. Checks out `glossarist/vocabulary-browser` at `main`
2. Installs dependencies (`npm ci`)
3. Fetches datasets and generates data
4. Builds the SPA
5. Deploys `dist/` to GitHub Pages

The workflow triggers on:
- Push to `main` in the geolexica.org repo
- `repository_dispatch` from vocabulary-browser (automatic when vocabulary-browser pushes to main)
- Manual trigger via the "Run workflow" button

See [geolexica/geolexica.org](https://github.com/geolexica/geolexica.org) for Pages configuration.

### This repository's build workflow

`.github/workflows/deploy.yml` runs on push to `main`:

1. Checks out the code
2. Runs `npm ci`
3. Fetches datasets (`npm run fetch-datasets`)
4. Builds GCR packages (`npm run build-gcr:all`)
5. Generates data (`npm run generate-data`)
6. Extracts edges (`node scripts/build-edges.js`)
7. Builds the SPA (`npm run build`)
8. Deploys to GitHub Pages (preview at the repository's Pages URL)
9. Triggers `geolexica.org` deployment via `repository_dispatch`

### Custom base path

By default the app deploys to the root (`/`). To deploy to a subdirectory (e.g., `/vocab/`):

```bash
BASE_PATH=/vocab/ npm run build
```

This sets the Vite `base` config so all asset paths are prefixed correctly.

### Other hosting platforms

The build produces static files in `dist/` with an SPA `404.html` fallback. Deploy `dist/` to any static host:

- **Netlify:** Set build command to `npm run build:full`, publish directory to `dist`, add `_redirects` file with `/* /index.html 200`
- **Vercel:** Set framework to Vite, build command to `npm run build:full`, output directory to `dist`
- **AWS S3 + CloudFront:** Upload `dist/` to S3, set error document to `index.html`, configure CloudFront for SPA routing
- **GitHub Pages:** Set **Settings → Pages → Source** to "GitHub Actions", then push to `main`
- **Any static host:** Upload `dist/` and configure all 404s to serve `index.html`

---

## Architecture

See [Architecture Documentation](docs/architecture.md) for:
- System architecture diagrams
- Component hierarchy
- Data pipeline details
- Adapter pattern and graph engine internals

### Tech Stack

- **Vue 3** + **TypeScript** + **Vite**
- **Pinia** (state management)
- **Vue Router** (SPA navigation)
- **Tailwind CSS 3** (utility-first styling)
- **D3.js** (force-directed graph)
- **KaTeX** (math rendering)
- **DM Serif Display** + **DM Sans** + **JetBrains Mono** (typography)

### Project structure

```
src/
├── adapters/          Data access layer (DatasetAdapter, AdapterFactory, UriRouter)
├── components/        Reusable Vue components (ConceptDetail, GraphPanel, SearchBar, etc.)
├── graph/             Graph engine for concept relationships (GraphEngine.ts)
├── stores/            Pinia stores (vocabulary, ui)
├── views/             Page-level components (HomeView, DatasetView, ConceptView, etc.)
├── utils/             Utilities (math rendering, language names, dataset styling)
└── style.css          Global styles and Tailwind layers

scripts/
├── fetch-datasets.mjs Clone + harmonize source repos
├── generate-data.mjs  Convert YAML → JSON-LD
├── build-edges.js     Extract cross-reference edges
├── build-gcr.mjs      Build GCR packages (optional)
└── generate-404.js    SPA fallback for GitHub Pages

docs/
├── adding-a-dataset.md  Step-by-step guide for adding datasets
├── dataset-schema.md    Canonical concept YAML format reference
├── gcr-spec.md          GCR packaging format specification
└── architecture.md      Full architecture documentation
```

---

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npx vitest run src/__tests__/graph.test.ts  # Single test file
```

Tests use Vitest with happy-dom environment. Vue Test Utils for component tests.

---

## License

This project is part of the [Glossarist](https://github.com/glossarist) ecosystem.
