# GCR (Glossarist Concept Repository) Packaging Format

GCR is a sealed packaging format for Glossarist concept datasets, modeled after the [LXR format](https://github.com/lutaml/lutaml-xsd) from `lutaml-xsd`. A `.gcr` file is a self-contained ZIP archive bundling harmonized concept data with metadata.

## ZIP Structure

```
my-dataset.gcr (ZIP archive)
├── metadata.yaml              # Dataset metadata + statistics
├── register.yaml              # Original register metadata from source repo
├── concepts/                  # Harmonized concept YAML files (canonical format)
│   ├── 102-01-01.yaml
│   ├── 102-01-02.yaml
│   └── ...
└── concepts_data/             # Pre-serialized (optional, for fast loading)
    └── ...                    # Future: JSON or Marshal serialized concepts
```

## metadata.yaml Schema

```yaml
title: IEC Electropedia (IEV)               # required
description: International Electrotechnical...  # required
glossarist_version: 2.4.0                    # required — gem version that produced this
created_at: "2026-04-28T12:00:00+09:00"     # required — ISO 8601
created_by: glossarist CLI                   # required

statistics:                                  # required
  concept_count: 22228                       # total concepts
  languages: [eng, ara, deu, fra, ...]       # all language codes present
  concepts_with_definitions: 20000           # concepts with ≥1 definition
  concepts_with_sources: 18000               # concepts with ≥1 source

owner: IEC TC 1                              # optional — owning organization
homepage: https://www.electropedia.org       # optional — original site
repository: https://github.com/glossarist/...  # optional — source repo
license: CC-BY-SA                            # optional — license identifier
tags: [electrotechnical, iec, multilingual]  # optional — descriptive tags

appearance:                                  # optional — visual customization
  color: "#3366ff"                           # primary brand color

links:                                       # optional — external references
  - name: IEC Electropedia                   #   link label
    url: https://www.electropedia.org        #   link URL

schema_version: "1.0.0"                      # required — GCR format version
```

## Required Fields in metadata.yaml

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Human-readable dataset title |
| `description` | string | Dataset description |
| `glossarist_version` | string | Version of glossarist gem that produced this package |
| `created_at` | string | ISO 8601 timestamp of package creation |
| `created_by` | string | Tool that created the package |
| `statistics.concept_count` | number | Total number of concepts |
| `statistics.languages` | string[] | ISO 639-2 language codes present |
| `schema_version` | string | GCR format version (currently "1.0.0") |

## Validation Rules

A valid `.gcr` file must satisfy:

1. **Structure**: ZIP contains `metadata.yaml` and `concepts/` directory
2. **Metadata**: `metadata.yaml` has all required fields
3. **Concepts**: `concepts/` has ≥1 YAML file
4. **Canonical format**: Each concept conforms to `docs/dataset-schema.md`
5. **No duplicates**: No duplicate `termid` values
6. **Integrity**: Cross-reference targets are valid concept IDs (optional check)

## Creating GCR Files

### Using glossarist CLI (recommended)

```bash
# Harmonize source data to canonical format
glossarist harmonize ./source-repo/concepts -o ./harmonized

# Package into GCR
glossarist package ./harmonized -o ./my-dataset.gcr \
  --title "My Dataset" \
  --owner "My Organization" \
  --color "#3366ff"

# Validate
glossarist validate ./my-dataset.gcr
```

### Using browser build pipeline (interim)

The browser's `fetch-datasets` script includes harmonization and can read from source repos directly. When the glossarist gem provides `glossarist package`, the pipeline will switch to consuming `.gcr` files.

## Relationship to LXR

GCR follows the same architectural pattern as LXR from `lutaml-xsd`:

| LXR | GCR | Purpose |
|-----|-----|---------|
| `metadata.yaml` | `metadata.yaml` | Self-describing package metadata |
| `schemas/*.xsd` | `concepts/*.yaml` | Raw content files |
| `schemas_data/*.marshal` | `concepts_data/` | Pre-serialized data (optional) |
| `lutaml_xsd_version` | `glossarist_version` | Tool version provenance |
| `xsd_mode` | N/A | No equivalent needed |
| `resolution_mode` | N/A | No equivalent needed |
| `serialization_format` | N/A | No equivalent needed |

Key difference: LXR supports multiple resolution/serialization modes (bare, resolved, marshal, json, yaml). GCR is simpler — concepts are always stored as harmonized YAML. Pre-serialization is optional and not needed for the browser.
