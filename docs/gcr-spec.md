# GCR (Glossarist Concept Repository) Packaging Format

GCR is a sealed packaging format for Glossarist concept datasets, modeled after the [LXR format](https://github.com/lutaml/lutaml-xsd) from `lutaml-xsd`. A `.gcr` file is a self-contained ZIP archive bundling harmonized concept data with metadata.

## Naming Convention

GCR files are named `{shortname}-{version}[-full].gcr`:

```
iev-1.0.0.gcr
iev-1.0.0-full.gcr
isotc211-2.3.0.gcr
isotc211-2.3.0-full.gcr
isotc204-1.0.0.gcr
isotc204-1.0.0-full.gcr
osgeo-1.2.0.gcr
osgeo-1.2.0-full.gcr
```

- **shortname** — machine-readable dataset identifier (lowercase, matches `id` in `datasets.yml`)
- **version** — semantic version of this dataset release
- **-full** suffix — indicates package includes `formats/` directory

## Release Convention

Each glossary repo publishes GCR packages as GitHub Releases, triggered by version tags:

| Trigger | Tag | Assets |
|---------|-----|--------|
| Push tag `v1.0.0` | `v1.0.0` | 4 files (see below) |

Each release includes **four assets**:
1. **Versioned standard**: `{shortname}-{version}.gcr`
2. **Unversioned standard alias**: `{shortname}.gcr`
3. **Versioned full**: `{shortname}-{version}-full.gcr`
4. **Unversioned full alias**: `{shortname}-full.gcr`

### How to publish

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or via GitHub UI: Releases → Draft a new release → tag `v1.0.0` → the workflow builds and uploads assets.

## Download URLs

```
# Latest (always points to newest non-prerelease release)
https://github.com/{org}/{repo}/releases/latest/download/{shortname}.gcr

# Pinned version
https://github.com/{org}/{repo}/releases/download/v1.0.0/{shortname}-1.0.0.gcr
```

## Package Variants

| Variant | Suffix | Contents |
|---------|--------|----------|
| **Standard** | `{shortname}-{version}.gcr` | `metadata.yaml` + `concepts/` |
| **Full** | `{shortname}-{version}-full.gcr` | Standard + `compiled/` directory |

The full variant adds pre-built whole-vocabulary format outputs (Turtle, JSON-LD, TBX, JSONL) for interchange and external consumers.

## ZIP Structure

### Standard Package

```
{shortname}-{version}.gcr (ZIP archive)
├── metadata.yaml              # Dataset metadata + version + statistics (REQUIRED)
├── register.yaml              # Original register metadata from source repo
├── concepts/                  # Harmonized concept YAML files (canonical format)
│   ├── 102-01-01.yaml
│   ├── 102-01-02.yaml
│   └── ...
├── bibliography.yaml          # Bibliographic references (OPTIONAL)
└── images/                    # Figure images referenced by concepts (OPTIONAL)
    ├── fig_A.1.png
    └── ...
```

### Full Package

```
{shortname}-{version}-full.gcr (ZIP archive)
├── metadata.yaml              # Dataset metadata (includes formats: [...] field)
├── register.yaml              # Original register metadata from source repo
├── concepts/                  # Harmonized concept YAML files (canonical format)
│   ├── 102-01-01.yaml
│   └── ...
├── bibliography.yaml          # Bibliographic references (OPTIONAL)
├── images/                    # Figure images referenced by concepts (OPTIONAL)
│   ├── fig_A.1.png
│   └── ...
└── compiled/                  # Whole-vocabulary format outputs
    ├── {shortname}.ttl        # SKOS Turtle (whole vocabulary)
    ├── {shortname}.jsonld     # SKOS JSON-LD (whole vocabulary)
    ├── {shortname}.tbx.xml    # TBX-XML (whole vocabulary)
    └── {shortname}.jsonl      # JSONL (one concept per line)
```

Every GCR package MUST contain `metadata.yaml` and `concepts/`. Full packages MUST also contain `compiled/` with at least one format file.

## bibliography.yaml (Optional)

Maps AsciiDoc cross-reference IDs to bibliographic entries. Referenced from concept content via `<<ref_XX,title>>` patterns.

```yaml
ref_1:
  reference: ISO 704
  title: Terminology work — Principles and methods
ref_16:
  reference: ISO 21217
  title: Intelligent transport systems — Station and communication architecture
ref_25:
  reference: ARC-IT
  title: 'United States Department of Transportation Architecture Reference...'
  link: https://www.arc-it.net
```

Each entry has:
- `reference` (required) — Short identifier (e.g., "ISO 21217")
- `title` (optional) — Full title
- `link` (optional) — URL to the referenced document

## images/ (Optional)

Figure images referenced from concept content via `<<fig_XX>>` AsciiDoc cross-references. Files are named to match the reference pattern (e.g., `fig_A.23.png` for `<<fig_A.23>>`).

## metadata.yaml Schema

```yaml
shortname: iev                                # required — machine-readable ID (matches datasets.yml id)
version: "1.0.0"                              # required — semver of this dataset release
title: IEC Electropedia (IEV)                 # required — human-readable name
description: International Electrotechnical... # required
glossarist_version: 2.5.0                     # required — glossarist gem version that produced this
created_at: "2026-04-28T12:00:00+09:00"       # required — ISO 8601
created_by: glossarist CLI                    # required — tool identity

uri: "urn:iec:std:iec:60050:*"                # required — dataset identity URI pattern (glob with *)
uri_aliases:                                  # optional — additional URI patterns that identify this dataset
  - "https://glossarist.org/iev/*"

dependencies:                                 # optional — auto-derived from concept references during packaging
  - uri: "urn:iso:std:iso:14812:*"            # URI pattern of the referenced dataset
    refCount: 45

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

formats: [turtle, jsonld, tbx, jsonl]         # optional — only in full packages; lists available compiled formats

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
| `uri` | string | Dataset identity URI pattern (glob with `*` wildcard). e.g., `"urn:iec:std:iec:60050:*"` or `"https://glossarist.org/iev/*"` |
| `statistics.total_concepts` | number | Total number of concepts |
| `statistics.languages` | string[] | ISO 639-2 language codes present |
| `schema_version` | string | GCR format version (currently `"1.0.0"`) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `uri_aliases` | string[] | Additional URI patterns that identify this dataset (e.g., both URN and URL forms) |
| `dependencies` | {uri: string, refCount: number}[] | Other datasets this package references. Auto-derived from concept references during packaging. |
| `owner` | string | Owning organization |
| `homepage` | string | URL to original site |
| `repository` | string | URL to source repo |
| `license` | string | License identifier |
| `tags` | string[] | Descriptive tags |
| `appearance.color` | string | Primary brand color (hex) |
| `formats` | string[] | Available compiled formats in full packages (e.g., `[turtle, jsonld, tbx, jsonl]`) |

## Validation Rules

A valid `.gcr` file must satisfy:

1. **Structure**: ZIP contains `metadata.yaml` and `concepts/` directory
2. **Metadata**: `metadata.yaml` has all required fields (`shortname`, `version`, `title`, `description`, `glossarist_version`, `created_at`, `uri`, `statistics`, `schema_version`)
3. **Concepts**: `concepts/` has ≥1 YAML file
4. **Canonical format**: Each concept conforms to `docs/dataset-schema.md`
5. **No duplicates**: No duplicate `termid` values
6. **Version**: `version` in metadata matches filename (if extractable)
7. **Valid references**: All cross-references in concept data must use proper URNs or absolute URIs. Ad-hoc prefixes (e.g., `IEV:103-01-02`) are rejected — use `urn:iec:std:iec:60050:103-01-02` instead. Packaging reports all invalid references and refuses to build.

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

Triggered by version tag push (`v*`). Builds both standard and full GCR packages, publishes as GitHub Release.

```yaml
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      version:
        description: 'Version (e.g. 1.0.0)'
        required: true

jobs:
  publish-gcr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
      - run: gem install glossarist

      - name: Determine version
        id: version
        run: |
          if [[ "${GITHUB_REF}" == refs/tags/v* ]]; then
            VERSION="${GITHUB_REF_NAME#v}"
          else
            VERSION="${{ inputs.version }}"
          fi
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"

      - name: Build standard GCR package
        run: |
          glossarist package . -o "${SHORTNAME}-${{ steps.version.outputs.version }}.gcr" \
            --shortname ${SHORTNAME} --version "${{ steps.version.outputs.version }}" \
            --title "${TITLE}" --owner "${OWNER}"

      - name: Build full GCR package (with formats)
        run: |
          glossarist package . -o "${SHORTNAME}-${{ steps.version.outputs.version }}-full.gcr" \
            --shortname ${SHORTNAME} --version "${{ steps.version.outputs.version }}" \
            --title "${TITLE}" --owner "${OWNER}" \
            --compiled-formats tbx,jsonld,turtle,jsonl

      - name: Create unversioned aliases
        run: |
          cp "${SHORTNAME}-${{ steps.version.outputs.version }}.gcr" "${SHORTNAME}.gcr"
          cp "${SHORTNAME}-${{ steps.version.outputs.version }}-full.gcr" "${SHORTNAME}-full.gcr"

      - name: Publish GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ steps.version.outputs.version }}
          name: "GCR Package v${{ steps.version.outputs.version }}"
          files: |
            ${SHORTNAME}-${{ steps.version.outputs.version }}.gcr
            ${SHORTNAME}.gcr
            ${SHORTNAME}-${{ steps.version.outputs.version }}-full.gcr
            ${SHORTNAME}-full.gcr
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
