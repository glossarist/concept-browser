# GCR Build Pipeline

## How it works

The vocabulary browser builds `.gcr` packages as part of its deploy pipeline:

```
fetch-datasets → build-gcr:all → generate-data → build-edges → build
```

1. **`fetch-datasets`** — For each dataset in `datasets.yml`:
   - If local `.gcr/{id}.gcr` exists → extract (fastest, no download)
   - If `gcrPackage` URL configured → download, then extract
   - If `sourceRepo` configured → clone + harmonize to `.datasets/{id}/`

2. **`build-gcr:all`** — Rebuilds all `.gcr` files from `.datasets/` into `.gcr/`. This ensures GCR packages are always up-to-date from whatever source was used.

3. **`generate-data`** — Converts YAML concepts to JSON-LD for the browser.

## Adding a new dataset

Add an entry to `datasets.yml`. Three source modes:

### GCR package (preferred)

```yaml
- id: isotc211
  gcrPackage: https://github.com/geolexica/isotc211-glossary/releases/latest/download/isotc211.gcr
  sourceRepo: https://github.com/geolexica/isotc211-glossary  # fallback
```

### Source repo (fallback)

```yaml
- id: iev
  sourceRepo: https://github.com/glossarist/glossarist-data-iev
```

`fetch-datasets` clones the repo and harmonizes concepts to canonical format.

### Local path (development)

```bash
DATASET_SOURCE_IEV=/path/to/local/checkout npm run fetch-datasets
```

## Building GCR packages manually

```bash
# Build all from .datasets/
npm run build-gcr:all

# Build single dataset
node scripts/build-gcr.mjs .datasets/isotc211 -o .gcr/isotc211.gcr
```

## Publishing GCR for downstream consumers

Each glossary repo can publish its GCR as a GitHub release asset. When configured in `datasets.yml` with `gcrPackage`, other consumers download it instead of cloning the repo.

The glossarist gem's `glossarist package` command (in development) will produce identical `.gcr` files from Ruby.
