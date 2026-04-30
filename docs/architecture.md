# Glossarist Vocabulary Browser — Architecture Guide

## Overview

The Glossarist Vocabulary Browser is a **statically deployed single-page application** (SPA) for browsing ISO terminology datasets. It renders concepts from multiple terminology registers with full multilingual support, cross-reference graphs, and review history timelines.

Built with **Vue 3 + TypeScript + Vite**, it compiles to static assets deployable to any web host (GitHub Pages, Netlify, S3, etc.). No server runtime is required.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Static Website (dist/)                        │
│                                                                  │
│  index.html ─── app.js ─── app.css                              │
│       │                                                          │
│       ├── public/data/iev/       ← IEC Electropedia (22K terms) │
│       ├── public/data/isotc211/  ← ISO TC 211 (1.3K terms)     │
│       ├── public/data/isotc204/  ← ISO TC 204 (312 terms)      │
│       └── public/data/osgeo/     ← OSGeo Lexicon (444 terms)   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

### High-Level Data Flow

```mermaid
flowchart TB
    subgraph "Data Preparation (offline)"
        A[datasets.yml] --> B[fetch-datasets.mjs]
        B -->|clone + harmonize| C[.datasets/{id}/concepts/*.yaml]
        C -->|generate-data.mjs| D[JSON-LD concept documents]
        C -->|build-edges.js| E[Edge index files]
        D --> F[manifest.json + index.json]
        D --> G[concepts/*.json]
        F --> H[public/data/{dataset}/]
        G --> H
        E --> H
    end

    subgraph "Build (Vite)"
        G -->|bundled as static assets| H[dist/]
    end

    subgraph "Runtime (Browser)"
        H -->|fetch| I[DatasetAdapter]
        I --> J[Pinia Store]
        J --> K[Vue Components]
        K --> L[User sees concepts, graphs, timelines]
    end
```

### Component Architecture

```mermaid
graph TB
    App["App.vue<br/>(layout shell)"]
    App --> Header["AppHeader.vue<br/>(logo + search)"]
    App --> Sidebar["AppSidebar.vue<br/>(nav + dataset list)"]
    App --> Router["&lt;router-view&gt;"]

    Router --> Home["HomeView.vue<br/>(hero + stats + cards)"]
    Router --> Dataset["DatasetView.vue<br/>(concept grid + filter)"]
    Router --> Concept["ConceptView.vue<br/>(loader + error)"]
    Router --> Search["SearchView.vue<br/>(search bar)"]
    Router --> Graph["GraphView.vue<br/>(graph wrapper)"]

    Dataset --> ConceptCard["ConceptCard.vue<br/>(single concept)"]
    Concept --> Detail["ConceptDetail.vue<br/>(tabs: Definition | Languages | History)"]
    Detail --> Timeline["ConceptTimeline.vue<br/>(vertical timeline)"]
    Detail --> LangDetail["LanguageDetail.vue<br/>(full multilingual view)"]
    Graph --> Panel["GraphPanel.vue<br/>(D3 force graph)"]
    Search --> SearchBar["SearchBar.vue<br/>(input + results)"]
```

### Data Layer Architecture

```mermaid
graph LR
    subgraph "Adapter Layer (open/closed)"
        Factory["AdapterFactory<br/>(singleton)"]
        Factory --> Adapter1["DatasetAdapter<br/>(iev)"]
        Factory --> Adapter2["DatasetAdapter<br/>(isotc211)"]
        Factory --> Adapter3["DatasetAdapter<br/>(isotc204)"]
    end

    subgraph "Store Layer (Pinia)"
        Store["useVocabularyStore()"]
        UIStore["useUiStore()"]
    end

    subgraph "Graph Layer"
        Engine["GraphEngine<br/>(directed multigraph)"]
    end

    Factory --> Store
    Adapter1 --> Store
    Adapter2 --> Store
    Adapter3 --> Store
    Store --> Engine

    subgraph "Static Data"
        M["manifest.json"]
        I["index.json"]
        C["concepts/*.json"]
        E["edges.json"]
    end

    M --> Adapter1
    I --> Adapter1
    C --> Adapter1
    E --> Adapter1
```

---

## Adding a New Dataset

New datasets require **zero code changes**. See `docs/adding-a-dataset.md` for the step-by-step guide. The adapter follows the **open/closed principle** — just edit `datasets.yml` and run the pipeline.

### Quick reference

```bash
# 1. Add entry to datasets.yml
# 2. Run pipeline
npm run fetch-datasets && npm run generate-data && node scripts/build-edges.js
# 3. Verify
npm run dev
# 4. Build
npm run build
```

---

## Concept Document Schema (JSON-LD)

Each concept is a JSON-LD document using the `gl:` (Glossarist) vocabulary:

```mermaid
classDiagram
    class ConceptDocument {
        +@context: string
        +@id: URI
        +@type: "gl:Concept"
        +gl:identifier: string
        +gl:localizedConcept: Record~lang, LocalizedConcept~
    }

    class LocalizedConcept {
        +@id: URI
        +@type: "gl:LocalizedConcept"
        +gl:languageCode: string
        +gl:entryStatus: string
        +gl:designation: Designation[]
        +gl:definition: DetailedDefinition[]
        +gl:notes: DetailedDefinition[]
        +gl:examples: DetailedDefinition[]
        +gl:source: ConceptSource[]
        +gl:reviewDate: string
        +gl:reviewDecisionDate: string
        +gl:reviewDecisionEvent: string
        +gl:reviewStatus: string
        +gl:reviewDecision: string
        +gl:reviewDecisionNotes: string
        +gl:dates: ConceptDate[]
        +gl:references: CrossReference[]
        +gl:release: number
    }

    class Designation {
        +@type: string
        +gl:normativeStatus: string
        +gl:term: string
        +gl:gender: string
        +gl:plurality: string
        +gl:international: boolean
    }

    class ConceptSource {
        +@type: string
        +gl:sourceType: string
        +gl:sourceStatus: string
        +gl:modification: string
        +gl:origin: Citation
    }

    class ConceptDate {
        +gl:dateType: string
        +gl:date: string
    }

    class CrossReference {
        +@id: URI
        +gl:term: string
    }

    ConceptDocument --> LocalizedConcept : gl:localizedConcept
    LocalizedConcept --> Designation : gl:designation
    LocalizedConcept --> ConceptSource : gl:source
    LocalizedConcept --> ConceptDate : gl:dates
    LocalizedConcept --> CrossReference : gl:references
```

### Example Concept

```json
{
  "@context": "https://glossarist.org/ns/context.jsonld",
  "@id": "https://glossarist.org/iev/concept/103-01-02",
  "@type": "gl:Concept",
  "gl:identifier": "103-01-02",
  "gl:localizedConcept": {
    "eng": {
      "@id": "https://glossarist.org/iev/concept/103-01-02/eng",
      "@type": "gl:LocalizedConcept",
      "gl:languageCode": "eng",
      "gl:entryStatus": "valid",
      "gl:designation": [
        {
          "@type": "gl:Expression",
          "gl:normativeStatus": "preferred",
          "gl:term": "functional"
        }
      ],
      "gl:definition": [],
      "gl:notes": [
        {
          "@type": "gl:DetailedDefinition",
          "gl:content": "An example of a functional..."
        }
      ],
      "gl:reviewDate": "2009-12-01T00:00:00+00:00",
      "gl:reviewDecisionDate": "2009-12-01T00:00:00+00:00",
      "gl:reviewDecisionEvent": "published"
    },
    "fra": { "...": "..." },
    "deu": { "...": "..." }
  }
}
```

---

## Data Pipeline

### From Source to Deployed Website

```mermaid
flowchart LR
    subgraph "Source Data (private)"
        A1["IEC Excel exports"]
        A2["ISO committee data"]
        A3["Custom YAML files"]
    end

    subgraph "Processing (glossarist-ruby)"
        B1["ManagedConceptCollection"]
        B2["load_from_files()"]
        B3["to_jsonld()"]
    end

    subgraph "Static Data Generation"
        C1["generate-data.mjs<br/>(manifest + index + chunks)"]
        C2["build-edges.js<br/>(edge extraction)"]
        C3["Vite build<br/>(bundle + deploy)"]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2 --> B3
    B3 --> C1
    B3 --> C2
    C1 --> C3
    C2 --> C3
    C3 --> D["dist/<br/>(deployable)"]
```

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/fetch-datasets.mjs` | Clones/updates source repos into `.datasets/`, harmonizes concept YAML to canonical format |
| `scripts/generate-data.mjs` | Reads harmonized YAML from `.datasets/`, generates JSON-LD concept documents, manifests, indexes |
| `scripts/build-edges.js` | Reads all concept files, extracts cross-references from `gl:references`, outputs `edges.json` per dataset |
| `scripts/generate-404.js` | Copies `dist/index.html` → `dist/404.html` for GitHub Pages SPA fallback |
| `npx vite build` | Bundles the Vue SPA with all static data into `dist/` |

---

## Key Design Decisions

### 1. Open/Closed Adapter Pattern

New datasets require **zero code changes** — only data files and a registry entry. The `DatasetAdapter` class is parameterized by `registerId` and `baseUrl`. All dataset-specific behavior comes from the data:

```
DatasetAdapter(registerId: "iev", baseUrl: "/data/iev")
DatasetAdapter(registerId: "isotc204", baseUrl: "/data/isotc204")
DatasetAdapter(registerId: "your-new-dataset", baseUrl: "/data/your-new-dataset")
```

### 2. Pre-Computed Edge Index

Cross-reference edges are extracted at build time and stored as `edges.json`. This avoids downloading thousands of concept files at runtime just to find the few that have cross-references.

**Before**: Pre-fetch 22,228 IEV concept files (~110MB) to find 822 with edges
**After**: Load one `edges.json` file (208KB) with all 1,218 pre-computed edges

### 3. Chunked Index for Large Datasets

Datasets with >1000 concepts use chunked indexes (500 concepts per chunk). The lightweight summary index loads at startup for browsing and search. Full concept data loads on demand from individual JSON files.

### 4. Graph Engine with Stub Nodes

The `GraphEngine` creates stub nodes for cross-reference targets that haven't been loaded yet. When a user navigates to a concept, its node is upgraded from stub to loaded with full designations.

### 5. Vue Reactivity with GraphEngine

Since `GraphEngine` is a plain TypeScript class with `Map` internals, Vue's reactivity system can't track mutations. The store uses a `graphVersion` counter incremented via `touchGraph()` after every graph mutation. Computed properties depend on this counter to re-evaluate.

---

## Dataset Reference

| Dataset | Register ID | Concepts | Languages | Edges | Owner |
|---------|-------------|----------|-----------|-------|-------|
| IEC Electropedia (IEV) | `iev` | 22,228 | 12 | 4,369 | IEC TC 1 |
| ISO/TC 211 Multi-Lingual Glossary | `isotc211` | 1,302 | 15 | 0 | ISO TC 211 |
| ISO/TC 204 ITS Vocabulary | `isotc204` | 312 | 1 | 845 | ISO TC 204 |
| OSGeo Lexicon | `osgeo` | 444 | 1 | 0 | OSGeo |

### Cross-Reference Extraction

Cross-references are extracted during the harmonization step (`fetch-datasets.mjs`) from inline patterns in definition/note/example text:
- `{{term name, IEV:103-01-02}}` → `references: [{id: "https://glossarist.org/iev/concept/103-01-02", term: "term name"}]`
- `{urn:iso:std:iso:14812:3.1.1.6,person}` → `references: [{id: "https://glossarist.org/isotc204/concept/3.1.1.6", term: "person"}]`

The cross-reference mapping tables are defined in `datasets.yml` under `crossReferences`.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Vue 3 + TypeScript | Reactive SPA |
| Build | Vite | Fast dev server + production bundling |
| State | Pinia | Centralized store with computed reactivity |
| Routing | Vue Router | SPA navigation |
| Styling | Tailwind CSS | Utility-first design system |
| Graph | D3.js | Force-directed graph visualization |
| Math | KaTeX | LaTeX math rendering (IEV `stem:[...]` notation) |
| Fonts | DM Serif Display + DM Sans + JetBrains Mono | Swiss editorial typography |

---

## File Reference

```
glossarist-vocabulary-browser/
├── public/
│   ├── datasets.json                          ← Dataset registry (generated)
│   └── data/
│       ├── iev/
│       │   ├── manifest.json
│       │   ├── index.json
│       │   ├── edges.json
│       │   ├── concepts/  (22,228 files)
│       │   └── chunks/    (45 files)
│       ├── isotc211/
│       │   ├── manifest.json
│       │   ├── index.json
│       │   ├── edges.json
│       │   └── concepts/  (1,302 files)
│       ├── isotc204/
│       │   ├── manifest.json
│       │   ├── index.json
│       │   ├── edges.json
│       │   └── concepts/  (312 files)
│       └── osgeo/
│           ├── manifest.json
│           ├── index.json
│           ├── edges.json
│           └── concepts/  (444 files)
├── src/
│   ├── adapters/
│   │   ├── types.ts          ← TypeScript interfaces
│   │   ├── DatasetAdapter.ts ← Data loading + edge extraction
│   │   ├── AdapterFactory.ts ← Singleton factory
│   │   └── UriRouter.ts      ← URI → concept resolution
│   ├── graph/
│   │   ├── GraphEngine.ts    ← Directed multigraph
│   │   └── index.ts
│   ├── stores/
│   │   ├── vocabulary.ts     ← Main data store
│   │   └── ui.ts             ← UI state (search query)
│   ├── views/                ← Page-level components
│   ├── components/           ← Reusable components
│   ├── utils/
│   │   ├── lang.ts           ← Language names + flags
│   │   ├── math.ts           ← KaTeX rendering + stem: parsing
│   │   └── dataset-style.ts  ← Dynamic dataset colors
│   ├── style.css             ← Tailwind layers + custom components
│   ├── main.ts               ← App entry point
│   └── App.vue               ← Root component
├── scripts/
│   ├── fetch-datasets.mjs    ← Clone + harmonize source repos
│   ├── generate-data.mjs     ← Generate manifest/index/concept files
│   ├── build-edges.js        ← Pre-compute edge indexes
│   └── generate-404.js       ← SPA fallback for GitHub Pages
├── .github/workflows/
│   └── deploy.yml            ← CI/CD pipeline
├── datasets.yml              ← Dataset registry (source of truth)
├── tailwind.config.js        ← Tailwind theme + colors
├── index.html                ← HTML entry with Google Fonts
└── vite.config.ts            ← Vite configuration
```
