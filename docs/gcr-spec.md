# GCR (Glossarist Concept Repository) Packaging Format

GCR is a sealed packaging format for Glossarist concept datasets, modeled after the [LXR format](https://github.com/lutaml/lutaml-xsd) from `lutaml-xsd`. A `.gcr` file is a self-contained ZIP archive bundling harmonized concept data with metadata.

## Naming Convention

GCR files are named `{shortname}-{version}.gcr`:

```
iev-1.0.0.gcr
isotc211-2.3.0.gcr
isotc204-1.0.0.gcr
osgeo-1.2.0.gcr
```

- **shortname** — machine-readable dataset identifier (lowercase, matches `id` in `datasets.yml`)
- **version** — semantic version of this dataset release

## Release Convention

Each glossary repo publishes GCR packages as GitHub Release assets:

| Release tag | Asset filename | Purpose |
|-------------|---------------|---------|
| `gcr-v1.0.0` | `isotc204-1.0.0.gcr` | Pinned version |
| `gcr-v1.0.1` | `isotc204-1.0.1.gcr` | Pinned version |
| `gcr-latest` | `isotc204.gcr` | Always the latest (updated on push to main) |

The `gcr-latest` tag is a rolling release — always updated to the latest version. Downstream consumers can pin to a specific version or track `gcr-latest`.

## Download URLs

```
# Pinned version
https://github.com/{org}/{repo}/releases/download/gcr-v1.0.0/{shortname}-1.0.0.gcr

# Latest (rolling)
https://github.com/{org}/{repo}/releases/download/gcr-latest/{shortname}.gcr
```

## ZIP Structure

```
{shortname}-{version}.gcr (ZIP archive)
├── metadata.yaml              # Dataset metadata + version + statistics (REQUIRED)
├── register.yaml              # Original register metadata from source repo
├── concepts/                  # Harmonized concept YAML files (canonical format)
│   ├── 102-01-01.yaml
│   ├── 102-01-02.yaml
│   └── ...
└── concepts_data/             # Pre-serialized (optional, for fast loading)
    └── ...                    # Future: JSON or Marshal serialized concepts
```

Every GCR package MUST contain `metadata.yaml` and `concepts/`.

## metadata.yaml Schema

```yaml
shortname: iev                                # required — machine-readable ID (matches datasets.yml id)
version: "1.0.0"                              # required — semver of this dataset release
title: IEC Electropedia (IEV)                 # required — human-readable name
description: International Electrotechnical... # required
glossarist_version: 2.5.0                     # required — glossarist gem version that produced this
created_at: "2026-04-28T12:00:00+09:00"       # required — ISO 8601
created_by: glossarist CLI                    # required — tool identity

statistics:                                   # required
  total_concepts: 22228
  languages: [eng, ara, deu, fra, ...]
  concepts_with_definitions: 20000
  concepts_with_sources: 18000
  concepts_by_status:
    valid: 22000
    draft: 228

owner: IEC TC 1                               # optional
homepage: https://www.electropedia.org        # optional
repository: https://github.com/glossarist/... # optional
license: CC-BY-SA                             # optional
tags: [electrotechnical, iec, multilingual]   # optional

appearance:                                   # optional
  color: "#3366ff"

schema_version: "1.0.0"                       # required — GCR format version
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `shortname` | string | Machine-readable dataset ID. Must match `id` in `datasets.yml` |
| `version` | string | Semantic version of this dataset release (e.g., `"1.0.0"`) |
| `title` | string | Human-readable dataset title |
| `description` | string | Dataset description |
| `glossarist_version` | string | Version of glossarist gem that produced this package |
| `created_at` | string | ISO 8601 timestamp of package creation |
| `created_by` | string | Tool that created the package |
| `statistics.total_concepts` | number | Total number of concepts |
| `statistics.languages` | string[] | ISO 639-2 language codes present |
| `schema_version` | string | GCR format version (currently `"1.0.0"`) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string | Owning organization |
| `homepage` | string | URL to original site |
| `repository` | string | URL to source repo |
| `license` | string | License identifier |
| `tags` | string[] | Descriptive tags |
| `appearance.color` | string | Primary brand color (hex) |

## Validation Rules

A valid `.gcr` file must satisfy:

1. **Structure**: ZIP contains `metadata.yaml` and `concepts/` directory
2. **Metadata**: `metadata.yaml` has all required fields (`shortname`, `version`, `title`, `description`, `glossarist_version`, `created_at`, `statistics`, `schema_version`)
3. **Concepts**: `concepts/` has ≥1 YAML file
4. **Canonical format**: Each concept conforms to `docs/dataset-schema.md`
5. **No duplicates**: No duplicate `termid` values
6. **Version**: `version` in metadata matches filename (if extractable)

## Creating GCR Files

### Using glossarist CLI (canonical method)

```bash
# Package a v1 dataset (concepts/*.yaml with termid)
glossarist package ./source-repo -o isotc204-1.0.0.gcr \
  --shortname isotc204 \
  --version 1.0.0 \
  --title "ISO/TC 204 ITS Vocabulary" \
  --owner "ISO/TC 204"

# Package a v2 dataset (geolexica-v2/*.yaml with UUID multi-doc)
glossarist package ./source-repo -o isotc211-2.3.0.gcr \
  --shortname isotc211 \
  --version 2.3.0 \
  --title "ISO/TC 211 Multi-Lingual Glossary" \
  --owner "ISO/TC 211"

# Upgrade v0 → v1 and package in one step
glossarist upgrade ./source-repo -o osgeo-1.2.0.gcr \
  --shortname osgeo \
  --version 1.2.0

# Validate
glossarist validate isotc204-1.0.0.gcr
```

### CI Workflow (in glossary repos)

```yaml
- name: Build GCR
  run: |
    VERSION="${GITHUB_REF_NAME#gcr-v}"  # extract version from tag like gcr-v1.0.0
    glossarist package . -o ${SHORTNAME}-${VERSION}.gcr \
      --shortname ${SHORTNAME} --version ${VERSION} \
      --title "${TITLE}" --owner "${OWNER}"

- name: Publish release
  uses: softprops/action-gh-release@v2
  with:
    tag_name: gcr-v${VERSION}
    files: ${SHORTNAME}-${VERSION}.gcr
```

## Relationship to LXR

GCR follows the same architectural pattern as LXR from `lutaml-xsd`:

| LXR | GCR | Purpose |
|-----|-----|---------|
| `metadata.yaml` | `metadata.yaml` | Self-describing package metadata |
| `schemas/*.xsd` | `concepts/*.yaml` | Raw content files |
| `schemas_data/*.marshal` | `concepts_data/` | Pre-serialized data (optional) |
| `lutaml_xsd_version` | `glossarist_version` | Tool version provenance |
| N/A | `shortname` + `version` | Dataset identity and version |
| N/A | `schema_version` | GCR format version |
