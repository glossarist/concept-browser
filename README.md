# Glossarist Concept Browser

A statically deployable terminology browser. Install as an npm package, configure via YAML, build, deploy.

## Quick Start

```bash
# 1. Create your project
mkdir my-dictionary && cd my-dictionary
npm init -y

# 2. Install
npm install @glossarist/concept-browser

# 3. Create site-config.yml
cat > site-config.yml << 'EOF'
id: my-dictionary
title: My Dictionary
uri_base: https://example.com
datasets:
  - id: my-vocab
    title: My Vocabulary
    local_path: datasets/my-vocab    # or gcr_package: https://...
EOF

# 4. Build
npx concept-browser build

# 5. Deploy
# Upload dist/ to any static host (GitHub Pages, Netlify, S3, etc.)
```

## How It Works

```
Your project (CWD)                    Package (read-only)
├── site-config.yml          ──┐
├── datasets/                 ─┤
│   └── my-vocab/             ─┤     ┌──────────────────────────┐
│       └── concepts/*.yaml   ─┤     │ @glossarist/concept-browser │
├── public/                   ─┤ ──> │                          │
│   └── (logos, favicons)     ─┤     │ generate-data.mjs        │
├── .cb-content/   ← generated │     │ bridge-to-astro.mjs      │
└── dist/          ← output    │     │ astro build              │
                             ──┘     └──────────────────────────┘
```

The package reads your config and data, generates `.cb-content/` (content collections) and `dist/` (static site) in your project. The package itself (`node_modules/`) is never modified.

## Configuration

Everything is in `site-config.yml`. See [`site-config.example.yml`](site-config.example.yml) for all options.

### Dataset location

Each dataset specifies where its source data lives. Three options:

```yaml
datasets:
  # Option A: Local directory with concepts/*.yaml
  - id: my-vocab
    local_path: datasets/my-vocab        # relative to project root

  # Option B: GCR package (auto-downloaded at build time)
  - id: iev
    gcr_package: https://github.com/org/repo/releases/download/v1.0/my-vocab.gcr

  # Option C: Git repository (cloned at build time)
  - id: iso-terms
    source_repo: https://github.com/org/iso-terms
```

### Colors

Each dataset can have a color — single hex or light/dark pair:

```yaml
datasets:
  - id: my-vocab
    color: "#2563eb"                      # single color (both modes)

  - id: legacy-vocab
    color:
      light: "#004996"                    # light mode
      dark: "#3B82F6"                     # dark mode
```

Colors appear in the sidebar (color dot per dataset), sphere cards (top bar + tint), badges, and relationship edges. If omitted, a palette color is assigned automatically.

Group colors work the same way:

```yaml
dataset_groups:
  - id: my-vocab-series
    color: "#d97706"
```

### Logo

Place logo SVGs/PNGs in `public/` and reference them in `branding`:

```yaml
branding:
  logo:
    alt: My Dictionary
    light: /images/logo-light.svg         # shown in light mode
    dark: /images/logo-dark.svg           # shown in dark mode
```

If no logo is configured, the Glossarist logo is shown by default. The footer always shows the Glossarist logo ("Powered by Glossarist").

### Fonts

Brand typography is fully slot-based and category-agnostic. There are **four slots** — `title`, `heading`, `body`, `mono` — and each slot accepts **any category** (`serif`, `sans-serif`, `monospace`). Nothing dictates that "headings must be serif" or "body must be sans-serif". Pick whatever combination matches your brand.

#### Slots

| Slot | Applies to | Default family | Default category |
|---|---|---|---|
| `title` | The single most-prominent text on each page (home hero, concept name on detail page, dataset/group title) | DM Serif Display | serif |
| `heading` | h2–h6 section headings | DM Serif Display | serif |
| `body` | Paragraph text, lists, table cells | DM Sans | sans-serif |
| `mono` | Code blocks, inline code, kbd | JetBrains Mono | monospace |

The defaults preserve the Glossarist visual identity — override any of them to match your brand.

#### Per-slot category override

Set `category` on any slot to control the fallback chain (the browser uses it when the primary family fails to load or is still loading):

```yaml
branding:
  fonts:
    title:
      family: Inter
      source: google
      category: sans-serif           # sans-serif title (was serif by default)
      weights: [400, 600, 700]
    heading:
      family: Inter
      source: google
      category: sans-serif
      weights: [600, 700]
    body:
      family: Merriweather
      source: google
      category: serif                # serif body (was sans-serif by default)
      weights: [400, 700]
    mono:
      family: Fira Code
      source: google
      category: monospace
      weights: [400, 500]
```

This produces:

| Slot | CSS variable | Stack |
|---|---|---|
| title | `--font-title` | `'Inter', system-ui, sans-serif` |
| heading | `--font-heading` (and `--font-header` for backward compat) | `'Inter', system-ui, sans-serif` |
| body | `--font-body` | `'Merriweather', Georgia, serif` |
| mono | `--font-mono` | `'Fira Code', ui-monospace, "JetBrains Mono", Menlo, Monaco, monospace` |

#### Source options

| `source` | Behavior |
|---|---|
| `google` | Build emits a Google Fonts CSS `@import` for the declared `family` + `weights`. |
| `url` | Build emits a `@font-face` block loading from `url`. |
| `local` | Consumer ships the font files in `public/`; no build-time fetch. |

#### Backward compatibility

The legacy `branding.fonts.header` slot still works — it's a deprecated alias for `branding.fonts.heading`. Existing configs don't break. The CSS variable `--font-header` is still emitted (as an alias for `--font-heading`) so existing stylesheets that reference it continue to work.

#### Mixed-category example: all sans-serif

```yaml
branding:
  fonts:
    title:   { family: Inter,        source: google, category: sans-serif }
    heading: { family: Inter,        source: google, category: sans-serif }
    body:    { family: Inter,        source: google, category: sans-serif }
    mono:    { family: JetBrains Mono, source: google, category: monospace }
```

#### Mixed-category example: traditional serif

```yaml
branding:
  fonts:
    title:   { family: Playfair Display, source: google, category: serif }
    heading: { family: Lora,             source: google, category: serif }
    body:    { family: Source Sans Pro,  source: google, category: sans-serif }
    mono:    { family: Source Code Pro,  source: google, category: monospace }
```

### Favicons

`branding.favicon` accepts two shapes — a legacy **string** form and an **object** form that lets consumers provide their own canonical favicon set without writing a post-build script.

#### String form (legacy, still supported)

Path to a single source SVG/PNG. The CLI generates the full variant set (favicon.ico, apple-touch-icon-*.png, etc.) from it using the `favicons` package:

```yaml
branding:
  favicon: assets/my-brand.svg
```

#### Object form (recommended for branded deployments)

The object form lets you provide your own canonical favicon set (typically RealFaviconGenerator output) and have the CLI install it without a post-build script.

A canonical favicon set is **multiple files** — typically `favicon.svg`, `favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, and `site.webmanifest`. Put all of them in a directory (e.g. `assets/favicons/`) and reference it via `source_dir`:

```
my-deployment/
├── site-config.yml
└── assets/
    └── favicons/                  ← branding.favicon.source_dir points here
        ├── favicon.svg
        ├── favicon.ico
        ├── favicon-96x96.png
        ├── apple-touch-icon.png
        ├── web-app-manifest-192x192.png
        ├── web-app-manifest-512x512.png
        └── site.webmanifest       ← optional; CLI regenerates with BASE_PATH
```

Then in `site-config.yml`:

```yaml
branding:
  favicon:
    base_path: /                              # URL prefix (BASE_PATH-aware; default '/')
    source_dir: assets/favicons               # canonical files (all of them, in one directory)
    icons:                                    # DATA — declare each icon, not HTML
      - rel: icon
        type: image/svg+xml
        href: favicon.svg
      - rel: icon
        type: image/png
        sizes: 96x96
        href: favicon-96x96.png
      - rel: shortcut icon
        href: favicon.ico
      - rel: apple-touch-icon
        sizes: 180x180
        href: apple-touch-icon.png
      - rel: manifest
        href: site.webmanifest
```

The CLI copies every file from `source_dir/` into `public/` (also removing the default cruft), then renders one `<link>` tag per icon entry. The `href` is a **filename** — the system applies the correct `base_path` prefix automatically. Absolute URLs (`https://cdn.example.com/x.png`) and root-relative paths (`/x.png`) are emitted unchanged.

| Field | Type | Effect |
|---|---|---|
| `source_dir` | string | Path (relative to cwd) to a directory containing **all** canonical favicon files. The CLI copies every file in this directory into `public/`, overriding any defaults. Also removes the default-generated cruft (`apple-touch-icon-57x57.png`, `favicon-16x16.png`, etc.) so it doesn't linger. |
| `icons` | `FaviconIcon[]` | **DATA — recommended.** Array of `{ rel, href, type?, sizes? }` entries. Each renders to one `<link>` tag with BASE_PATH-aware href. Replaces the default 16-link set. |
| `skip_default_links` | boolean | When true, the CLI does NOT call the `favicons` package and does NOT emit the default `<link>` tags. Pair with `icons` and `source_dir` for fully custom branding. |
| `base_path` | string | URL prefix prepended to every emitted link. Useful for BASE_PATH-scoped deployments (e.g. `/vocab/`). |
| ~~`links_html`~~ | string | **@deprecated** — use `icons` instead. Raw HTML emitted verbatim. Impossible to validate or safely BASE_PATH-rewrite; kept for backward compat with a console warning. |

The object form exists so consumers with a RealFaviconGenerator favicon set (or any other canonical brand favicon bundle) can install it without a post-build script. Previously this required workarounds like `glossarist/cie-eilv/scripts/install-favicons.mjs` (149 lines) and `glossarist/iala-vocab/scripts/install-favicons.mjs` (175 lines) — both are now unnecessary.

If neither form is set, the Glossarist default favicon is used.

### About pages

Place JSON files in `public/pages/`:

```
public/
└── pages/
    ├── about.json          → /about
    └── my-vocab-about.json → /my-vocab-about
```

Each file:

```json
{
  "title": "About This Dictionary",
  "html": "<p>Content here. Supports full HTML.</p>"
}
```

The page appears in the sidebar navigation automatically.

### Full example

See [`site-config.example.yml`](site-config.example.yml) for all options including UI languages, fonts, features, and dataset groups.

## Data/Deployment Boundary

Concept-browser enforces a strict separation between **data** (authored by dataset authors) and **deployment** (configured by deployers):

- **Dataset authors** write concepts, sources, bibliography, and inline mentions. They don't know where their dataset will be deployed or what other datasets will be co-deployed.
- **Deployers** write `site-config.yml` to register datasets, declare URI patterns, and optionally add routing entries for external datasets. They never edit dataset content.
- **Concept-browser** resolves every cross-reference at runtime via a fixed cascade, making multiple datasets behave as one coherent whole.

### The resolution cascade

Every `{{cite:...}}` and `{{urn:...}}` mention walks this cascade at render time:

1. **`uriPatterns`** — is there a co-deployed dataset that matches? → internal link (case 1)
2. **`routing[]`** — is there a routing entry for the URI? → external link (case 2)
3. **`citation.link`** — does the source have a canonical link? → flat bib record (case 3)
4. **Unresolved** — plain text

The same YAML renders differently in different deployments. The data never changes.

## Inline Content Syntax

All inline references in concept text use the unified `{{kind:target}}` notation:

| Kind | Example | What it does |
|---|---|---|
| `cite` | `{{cite:sourceId}}` | Cite a `ConceptSource` from this concept's `sources[]` — walks the full resolution cascade |
| `urn` | `{{urn:iso:std:iso:704}}` | Reference a concept via URN routing |
| `fig` | `{{fig:diagram_3}}` | Reference a figure entity in the same dataset |
| `table` | `{{table:units}}` | Reference a table entity |
| `formula` | `{{formula:ohm_law}}` | Reference a formula entity |
| `bib` | `{{bib:ref_1}}` | Reference a bibliography entry (case-3-only, no underlying concept) |
| `link` | `{{link:https://example.com}}` | External URL (canonical, deployment-independent) |
| `image` | `{{image:src, alt}}` | Inline image embed |
| *(none)* | `{{measurement unit}}` | Designation match in same dataset |
| *(none)* | `{{112-01-10}}` | Numeric ID match in same dataset |

Each kind accepts an optional label: `{{kind:target, label}}`.

**Deprecated:** `<<ref,title>>` (AsciiDoc xref syntax) emits a deprecation warning. Migrate to `{{kind:target}}`.

See `/learn/inline-content` on any deployed site for a full interactive reference.

## CLI Commands

```
npx concept-browser fetch      # Download datasets from GCR/repos
npx concept-browser generate   # Convert YAML → JSON-LD + RDF artifacts
npx concept-browser build      # Full pipeline: fetch + generate + build site
```

## .gitignore for Your Project

Add these to your project's `.gitignore`:

```
.cb-content/
dist/
.datasets/
.gcr/
public/data/
```

## Data Format

Each concept is a YAML file in `datasets/{id}/concepts/`:

```yaml
---
data:
  identifier: "1-1-1"
  localized_concepts:
    eng: <uuid>
  sources:
    - type: authoritative
      origin:
        ref:
          source: "ISO 9000"
  definition:
    - content: "The concept definition text."
  terms:
    - type: expression
      normative_status: preferred
      designation: "quality"
  language_code: eng
---
```

Or use a Glossarist GCR package — set `gcr_package` in your dataset config and the CLI downloads it automatically.

## Deployment

The build outputs a static site to `dist/`. Deploy it anywhere:

- **GitHub Pages**: Push `dist/` to `gh-pages` branch
- **Netlify/Vercel**: Set build command to `npx concept-browser build`, publish directory to `dist/`
- **S3/CloudFront**: `aws s3 sync dist/ s3://my-bucket/`

No server required. All data is pre-built into static JSON files.
