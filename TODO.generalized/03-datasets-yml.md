# Status: DONE

# 03 — Create datasets.yml + .gitignore

## Context

The browser needs a configuration file listing all datasets with their source repos, colors, and metadata. Currently the dataset list is hardcoded in `generate-data.mjs` (lines 309-346). Externalizing it to `datasets.yml` means adding a dataset requires only editing one file.

## Task

### Create `datasets.yml`

```yaml
# datasets.yml — Glossarist Vocabulary Browser dataset registry
# Add a new dataset by adding an entry below. No code changes required.
# Run: npm run fetch-datasets && npm run generate-data && npm run build-edges

datasets:
  - id: iev
    sourceRepo: https://github.com/glossarist/glossarist-data-iev
    title: "IEC Electropedia (IEV)"
    owner: IEC TC 1
    existingSiteUrl: https://www.electropedia.org
    color: "#3366ff"
    tags: [electrotechnical, iec, multilingual]

  - id: isotc211
    sourceRepo: https://github.com/geolexica/isotc211-glossary
    owner: ISO/TC 211
    existingSiteUrl: https://isotc211.geolexica.org
    color: "#0d9488"
    tags: [geographic-information, gis, iso, multilingual]

  - id: isotc204
    sourceRepo: https://github.com/geolexica/isotc204-glossary
    owner: ISO/TC 204
    existingSiteUrl: https://isotc204.geolexica.org
    color: "#d97706"
    tags: [transport, its, iso, automated-driving]

  - id: osgeo
    sourceRepo: https://github.com/geolexica/osgeo-glossary
    owner: OSGeo
    existingSiteUrl: https://osgeo.geolexica.org
    color: "#059669"
    tags: [osgeo, open-source, gis]
```

Metadata resolution: `datasets.yml` overrides → repo's `register.yaml` → defaults.

### Create `.gitignore`

```
node_modules/
dist/
.datasets/
public/data/
*.tsbuildinfo
.DS_Store
.env
.env.local
```

## Files

- Create: `datasets.yml`
- Create: `.gitignore`

## Verification

- `datasets.yml` parses as valid YAML
- `.gitignore` excludes generated data directories
