# PROPOSAL: Single Source of Truth for Dataset Metadata

## Status

**Updated 2026-07-05** — partially overtaken by `b618eaf` (about pipeline)
and `58a907a` (color SSOT). The proposal is tightened below to address
only what remains open. See "What's already done" section.

## Summary

Dataset descriptive metadata currently lives in **four overlapping
places**, with no clear precedence rule. Consumers cannot answer "what
is the title of this dataset?" without knowing which file the question
is about, and authors cannot update a description without editing it in
multiple files. This proposal consolidates dataset metadata into **one
source of truth** per dataset, with deployment repos holding only the
layout concerns (where to fetch the data from).

## Problem

A single dataset today has its title, description, owner, and source
information scattered across:

1. **`site-config.yml`** in the deployment repo (`DatasetConfig`):
   - `title`, `description`, `owner`, `color`, `tags`, `ref`, `refAliases`,
     `translations`, `sourceRepo`
   - Used at build time, but with **register.yaml precedence** (register
     wins, site-config is the fallback — verified in
     `scripts/generate-data.mjs:1170` for `languages` and `description`).

2. **`register.yaml`** in the dataset itself (`DatasetRegister`):
   - `name` (localized object), `description` (localized object),
     `about` (localized paths to per-edition markdown), `owner`,
     `sourceRepo`, `ref`, `refAliases`, `tags`, `logo`, `status`,
     `supersedes`, `year`, `languages`, `languageOrder`, `ordering`,
     `sections`
   - Travels with the dataset inside the GCR. Read at build time for
     `languages` and `description` resolution; **not** read for
     `title`/`owner`/`sourceRepo`/`ref` (verified by absence in
     `generate-data.mjs`).

3. **`pages:` array** in `site-config.yml` (`PageConfig`):
   - One global `about` page per site, source path is in the deployment
     repo. Site-level only — no per-dataset equivalent in this array.

4. **`about:` field** in `register.yaml` (localized paths):
   - **Dead.** Concept-browser does not read this field. About content
     is discovered via filesystem convention (see below).

### Symptoms

- **Drift.** Two humans edit the same field in two files. Build-time
  resolution picks one (register wins for `description`/`languages`;
  site-config wins for everything else by default since register isn't
  consulted). Neither human knows which without reading the source.
- **Ambiguity.** `description` on the deployment's `DatasetConfig`
  (single string) and `description` on the dataset's `DatasetRegister`
  (localized object) have the same name but different shapes. The
  register version wins when both are populated; site-config is the
  fallback.
- **Inconsistency.** A dataset deployed to two sites may have different
  `title`/`owner`/`sourceRepo` in each deployment's `site-config.yml`,
  even though the underlying dataset is identical. The dataset loses
  its identity for these fields because they're not read from register.
- **Loss of provenance.** `register.yaml`'s `about:` field is unused.
  About content is discovered by scanning
  `.datasets/<id>/about/about.{lang}.{md,adoc,html}` — a filesystem
  convention with no schema backing.
- **Two `about:` mechanisms.** register.yaml's `about:` field and the
  filesystem `about/` directory both exist. They mean different things
  and neither tool validates their agreement.

### Concrete example

In the `isotc204-glossary` lineage-series deployment (PRs
[geolexica/isotc204-glossary#33](https://github.com/geolexica/isotc204-glossary/pull/33),
[#34](https://github.com/geolexica/isotc204-glossary/pull/34), and
[geolexica/isotc204.geolexica.org#28](https://github.com/geolexica/isotc204.geolexica.org/pull/28)),
the same three-line description for each edition must be written into
**both** the deployment's `site-config.yml` AND the dataset's
`register.yaml` (description is read from register; but title/owner
must be in site-config since register isn't consulted for them).
PR #34 also placed per-edition about pages at `<dataset>/about-eng.md`
and registered them via `register.yaml: about:` — but concept-browser
ignores that field and scans for `<dataset>/about/about.eng.md`
instead. PR #34 needs revision before it works.

## What's already done

These parts of the original proposal are now implemented and removed
from scope:

- **About content pipeline** (commit `b618eaf`, `scripts/process-about-pages.mjs`).
  Per-dataset and per-group about pages compiled from
  `.datasets/<id>/about/about.{lang}.{md,adoc,html}` and
  `site-content/groups/<id>/about/about.{lang}.adoc`. Routes:
  `/group/<id>` and `/group/<id>/about`. Site-level about (from
  `site-config.yml:pages[]`) still routes to `/about`.
- **Color SSOT** (commit `58a907a`). `colors.dataset[id]` and
  `colors.group[id]` in `site-config.json` are the per-deployment
  override SSOT. The `color?:` field on `DatasetConfig` and
  `DatasetGroup` remains as a fallback default.
- **Group-kind visual distinction** (`b618eaf`). Sidebar group headers
  show the kind glyph with CSS variable accent color. No metadata
  duplication concern here.

## Proposal (what remains)

### Principle

Dataset metadata that travels with the data (GCR or local checkout) is
authoritative for **content** fields: `name`, `description`, `about`,
`owner`, `sourceRepo`, `ref`, `refAliases`, `tags`, `logo`, `status`,
`supersedes`, `year`, `languages`, `languageOrder`, `ordering`,
`sections`.

Deployment metadata that doesn't travel with the data is authoritative
for **layout** concerns: `id`, `uri` (deployment's URI prefix for
routing), `gcrPackage` or `localPath` (where to fetch the data), `color`
(deployment-side accent), `datasetGroups` membership, `existingSiteUrl`.

### Concrete changes

#### 1. Trim `DatasetConfig` to deployment-only fields

```ts
export interface DatasetConfig {
  // Identity + fetch source — deployment knows where the data lives
  id: string;
  uri: string;             // routing prefix
  uriAliases?: string[];
  gcrPackage?: string;     // remote
  localPath?: string;      // local checkout
  existingSiteUrl?: string;

  // Deployment-scoped presentation
  color?: DatasetColorSpec;  // fallback default; override via colors.dataset[id]

  // Optional per-deployment override (with explicit semantics)
  overrides?: DatasetOverrides;
}

export interface DatasetOverrides {
  title?: LocalizedText;        // explicit "I am overriding the register's title"
  description?: LocalizedText;
  owner?: string;
  sourceRepo?: string;
  ref?: string;
  refAliases?: string[];
  tags?: string[];
  // ... whatever fields a deployment legitimately needs to override
}
```

Anything not in `DatasetConfig` or `DatasetOverrides` is loaded from
`register.yaml` at fetch time and surfaced via `manifest.json`.

#### 2. Make `manifest.json` the runtime SSOT

The build pipeline already emits `manifest.json` per dataset. Make it
the single source that the UI reads for all dataset metadata:

```json
{
  "id": "isotc204-ed3",
  "title": "ISO/TC 204 ITS Vocabulary (Edition 3, draft)",
  "description": "Edition 3 draft, generated from the iso14812 ontology...",
  "about": { "eng": "/pages/dataset-isotc204-ed3-about.json" },
  "owner": "ISO/TC 204",
  "status": "current",
  "supersedes": "isotc204-2025",
  "year": 2026,
  "ref": "ISO 14812 (Edition 3, draft)",
  ...
}
```

UI components read from manifest only — not from site-config. The
about-content pipeline already emits `public/pages/dataset-<id>-about.*.json`;
manifest surfaces the URL.

#### 3. Decide the fate of `register.yaml:about:`

Two options:

- **Option A (recommended): Remove the field.** The filesystem
  convention `about/about.{lang}.{md,adoc,html}` is the discovery
  mechanism. Drop `about:` from the v3 `DatasetRegister` schema to
  match reality.
- **Option B: Wire concept-browser to honor it.** If the dataset
  author wants explicit paths (e.g. for non-standard locations), make
  `process-about-pages.mjs` consult `register.yaml:about:` first and
  fall back to filesystem scan. Document the precedence.

Option A is simpler and matches the implementation. Recommend unless
someone has a concrete use case for explicit paths.

#### 4. Drop duplicate fields from `site-config.yml:datasets[]`

After the migration, each field appears in exactly one place:

| Field              | Lives in          | Reason                            |
|--------------------|-------------------|-----------------------------------|
| `id`               | both (must match) | deployment references dataset by id |
| `uri`              | site-config       | deployment routing concern         |
| `gcrPackage`/`localPath` | site-config | deployment fetch source         |
| `existingSiteUrl`  | site-config       | deployment-only link               |
| `name`             | register          | dataset's own identity             |
| `description`      | register          | dataset's own identity             |
| `about`            | filesystem        | `about/about.{lang}.md` discovery  |
| `owner`            | register          | dataset's own identity             |
| `sourceRepo`       | register          | dataset's own identity             |
| `ref`, `refAliases`| register          | dataset's own identity             |
| `tags`             | register          | dataset's own identity             |
| `status`           | register          | dataset's own identity             |
| `color`            | site-config       | deployment accent palette          |
| `datasetGroups`    | site-config       | cross-dataset layout               |

### Migration

- **Step 1**: Extend `generate-data.mjs` to read ALL register fields
  (currently only `languages` and `description` are read from register;
  extend to `title`, `owner`, `sourceRepo`, `ref`, `refAliases`,
  `tags`). This makes register the SSOT without removing anything from
  site-config.
- **Step 2**: Surface all register fields through `manifest.json`. UI
  components stop reading site-config directly for these fields.
- **Step 3**: Trim `DatasetConfig` to the deployment-only fields. Add
  `DatasetOverrides` for explicit per-deployment deviations.
- **Step 4**: Resolve `register.yaml:about:` (Option A or B above).
- **Step 5**: Add a `concept-browser doctor` check that flags
  duplicated fields and recommends moving them to the dataset.

### Non-goals

- **Changing the GCR format.** The proposal is about config and runtime
  behavior, not the GCR packaging.
- **Multi-site deployment stories.** If the same dataset is deployed to
  multiple sites with different presentation, that's what `color` and
  `overrides` are for. Not a metadata-SSOT concern.
- **Per-concept metadata.** Concepts inside a dataset already have one
  source of truth (the YAML). This proposal is about dataset-level
  metadata only.
- **Site-level about page.** The `pages: [{type: 'about'}]` array entry
  for site-wide about is orthogonal and stays as-is.

## Open questions

1. **Should `uri` move to the dataset register?** Currently deployment-
   specific because it's used as a routing prefix. But the URN inside
   `urn:iso:std:iso:14812:2025:*` IS a dataset property. Resolution:
   keep `uri` as a deployment-side routing template, but the dataset's
   `urn` (in register) is the canonical identity.

2. **How does this interact with lineage-series `datasetGroups`?** The
   group itself has a `color`, `label`, and `kind`. The group's metadata
   could move into a "dataset-group" entity file in the deployment repo
   (parallel to the per-dataset register), OR travel in site-config.
   Current implementation has group about pages via
   `site-content/groups/<id>/about/` — a third location. Out of scope
   here, but flag for follow-up.

3. **What about `existingSiteUrl`?** Currently a `DatasetConfig` field.
   Could move to register if the dataset has a canonical external site.
   Tentative answer: keep in site-config — it's deployment-specific
   (different sites may link to different "canonical" references).

## References

- Current `DatasetConfig` shape: `src/config/types.ts:85`
- Current `PageConfig` shape: `src/config/types.ts:138`
- About content pipeline: `scripts/process-about-pages.mjs` (commit `b618eaf`)
- Color SSOT: `src/config/types.ts:218` (commit `58a907a`)
- Register.yaml resolution (partial): `scripts/generate-data.mjs:1140` (only
  `languages` and `description` consulted today)
- `DatasetRegister` (glossarist gem): `lib/glossarist/dataset_register.rb`
- Triggering deployment PRs:
  - geolexica/isotc204-glossary#33 (data)
  - geolexica/isotc204-glossary#34 (per-edition about pages + status fixes —
    needs revision per Option A above)
  - geolexica/isotc204.geolexica.org#28 (deployment config)
