# Status: DONE

# 02 — GCR Packaging Format Specification

## Context

Modeled after LXR from `lutaml-xsd`. A sealed `.gcr` ZIP file bundles harmonized concept data + metadata so that datasets are immutable, self-describing artifacts. The browser pipeline reads GCR files instead of raw repos.

## Task

Create `docs/gcr-spec.md` defining the GCR format.

### GCR ZIP structure

```
my-dataset.gcr (ZIP)
├── metadata.yaml              # Dataset metadata + statistics
├── register.yaml              # Original register metadata from source repo
├── concepts/                  # Harmonized concept YAML files (canonical format)
│   ├── 102-01-01.yaml
│   ├── 102-01-02.yaml
│   └── ...
└── concepts_data/             # Pre-serialized (optional, for fast loading)
    └── ...                    # Future: JSON or Marshal serialized concepts
```

### metadata.yaml schema

```yaml
title: IEC Electropedia (IEV)               # required
description: International Electrotechnical...  # required
glossarist_version: 2.4.0                    # required
created_at: "2026-04-28T12:00:00+09:00"     # required
created_by: glossarist CLI                   # required

statistics:                                  # required
  concept_count: 22228
  languages: [eng, ara, deu, fra, ...]
  concepts_with_definitions: 20000
  concepts_with_sources: 18000

owner: IEC TC 1                              # optional
homepage: https://www.electropedia.org       # optional
repository: https://github.com/glossarist/...  # optional
license: CC-BY-SA                            # optional
tags: [electrotechnical, iec, multilingual]  # optional

appearance:                                  # optional
  color: "#3366ff"

links:                                       # optional
  - name: IEC Electropedia
    url: https://www.electropedia.org

schema_version: "1.0.0"                      # required
```

### Validation rules (for `glossarist validate`)

- `metadata.yaml` exists and parses
- `concepts/` directory exists with ≥1 YAML file
- Each concept has `termid` (string)
- Each concept has ≥1 language block with ≥1 term
- No duplicate `termid` values
- `definition` is always array of `{content: "..."}` (harmonized)
- `sources` is always array (no `authoritative_source` singular)
- `entry_status` values are from allowed set: `valid`, `superseded`, `withdrawn`, `draft`
- Cross-references (if present) are valid concept IDs

### Reference: LXR format (lutaml-xsd)

The LXR format is a ZIP with `metadata.yaml` + `schemas/*.xsd` + `schemas_data/*.marshal`. Key files:
- `/Users/mulgogi/src/lutaml/lutaml-xsd/lib/lutaml/xsd/schema_repository_package.rb` — ZIP read/write
- `/Users/mulgogi/src/lutaml/lutaml-xsd/lib/lutaml/xsd/package_builder.rb` — serialization orchestration
- `/Users/mulgogi/src/lutaml/lutaml-xsd/lib/lutaml/xsd/schema_repository_metadata.rb` — metadata model
- `/Users/mulgogi/src/lutaml/lutaml-xsd/lib/lutaml/xsd/package_configuration.rb` — strategy configuration

## Files

- Create: `docs/gcr-spec.md`

## Verification

- Document exists, specifies ZIP structure, metadata schema, validation rules
- References canonical format from `docs/dataset-schema.md`
