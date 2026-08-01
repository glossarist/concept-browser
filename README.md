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
    skip_default_links: true                  # suppress the default <link> block
    source_dir: assets/favicons               # canonical files (all of them, in one directory)
    links_html: |-                            # raw HTML emitted verbatim in <head>
      <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />
```

| Field | Type | Effect |
|---|---|---|
| `source_dir` | string | Path (relative to cwd) to a directory containing **all** canonical favicon files. The CLI copies every file in this directory into `public/`, overriding any defaults. Also removes the default-generated cruft (`apple-touch-icon-57x57.png`, `favicon-16x16.png`, etc.) so it doesn't linger. |
| `links_html` | string | Raw HTML (one or more `<link>` tags) emitted verbatim in `<head>`. Use this to declare which of the source_dir files the browser should load, with what `sizes`/`type`. |
| `skip_default_links` | boolean | When true, the CLI does NOT call the `favicons` package and does NOT emit the default `<link>` tags. Pair with `links_html` and `source_dir` for fully custom branding. |
| `base_path` | string | URL prefix prepended to every emitted link. Useful for BASE_PATH-scoped deployments (e.g. `/vocab/`). |

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
