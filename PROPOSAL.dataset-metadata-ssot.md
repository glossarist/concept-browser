# PROPOSAL: Single Source of Truth for Dataset Metadata

## Status

**Updated 2026-07-05 (revision 2)** — partially overtaken by `b618eaf`
(about pipeline) and `58a907a` (color SSOT). This revision corrects an
earlier error: most register fields *are* already read by
`generate-data.mjs` (not just `languages`/`description`). The actual
remaining issue is the **inconsistent precedence rule** across fields.
See "Current precedence" table and "What's already done" below.

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

2. **`register.yaml`** in the dataset itself (modeled by
   `glossarist-js`'s `Register` class — see `src/models/register.js`):
   - First-class fields: `id`, `ref`, `refAliases`, `year`, `urn`,
     `urnAliases`, `status`, `supersedes`, `owner`, `sourceRepo`, `tags`,
     `languages`, `languageOrder`, `ordering`, `logo`, `description`
     (localized object), `about` (localized paths), `provenance`,
     `contributors`, `sections`. There is **no `name`/`title` field** on
     the model — the closest is `ref` (the citation string, e.g.
     `"ISO 14812:2025"`).
   - Travels with the dataset inside the GCR. Read at build time as a
     **fallback** for most content fields (see precedence table below).
   - **`about:`** is parsed onto `Register.about` but concept-browser
     never consults it — about content is discovered via filesystem
     convention only (`scripts/process-about-pages.mjs`).

3. **`pages:` array** in `site-config.yml` (`PageConfig`):
   - One global `about` page per site, source path is in the deployment
     repo. Site-level only — no per-dataset equivalent in this array.

4. **`about:` field** in `register.yaml` (localized paths):
   - **Dead.** Concept-browser does not read this field. About content
     is discovered via filesystem convention (see below).

### Symptoms

- **Inconsistent precedence.** `languages` and `description` resolve
  with **register wins** (site-config is the fallback); every other
  content field resolves with **site-config wins** (register is the
  fallback). Verified in `scripts/generate-data.mjs:1166-1199`. There
  is no single rule; humans cannot predict which file wins without
  reading the source.
- **Drift.** Because both files are *consulted* for most fields, two
  humans can edit the same field in two files and the build silently
  picks one. The duplicate stays in the other file as latent drift.
- **Ambiguity.** `description` on the deployment's `DatasetConfig`
  (single string) and `description` on the dataset's `Register`
  (localized object) have the same name but different shapes. The
  register version wins when both are populated; site-config is the
  fallback.
- **Title has no real source.** `Register` has no `name`/`title` field.
  Title resolves as `ds.title || reg?.ref || ds.id` — i.e. the
  citation string is repurposed as the display title when site-config
  omits one. This is a footgun.
- **Loss of provenance.** `register.yaml`'s `about:` field is parsed
  but unused. About content is discovered by scanning
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
have to be duplicated in site-config to take effect, because the
default precedence for those fields is site-config-wins — the register
fallback only kicks in when site-config is silent).
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
- **Register field reading** (current state of
  `scripts/generate-data.mjs`). Most register fields *are* read at
  build time (owner, sourceRepo, ref, refAliases, tags, status, urn,
  urnAliases, sections, ordering, languageOrder, languages,
  description). The remaining issue is the **inconsistent precedence
  rule** — see "Proposal (what remains)" below.

## Proposal (what remains)

### Principle

Dataset metadata that travels with the data (GCR or local checkout) is
authoritative for **content** fields: `description`, `about`, `owner`,
`sourceRepo`, `ref`, `refAliases`, `tags`, `logo`, `status`,
`supersedes`, `year`, `languages`, `languageOrder`, `ordering`,
`sections`.

> **Note on title.** `Register` currently has no `name`/`title` field.
> The display title resolves as `ds.title || reg?.ref || ds.id` today.
> Two options: (a) add a first-class `name` field to `Register` in
> `glossarist-js` (preferred long-term); (b) accept `ref` as the title
> proxy and document it. This proposal assumes (a) will happen and uses
> `name` / `title` interchangeably below.

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
| `name`             | register (pending upstream addition to `Register`) | dataset's own identity             |
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

- **Step 1 (DONE — close the gap)**: Most register fields *are* already
  read by `generate-data.mjs`. The remaining gap is the **inconsistent
  precedence rule**: today `languages`/`description` use register-wins
  while every other content field uses site-config-wins. Pick one rule
  (recommend: **register-wins** for all content fields, **site-config
  only via explicit `overrides`**) and apply it uniformly. This is a
  one-place change in `generate-data.mjs:1166-1199`.
- **Step 2**: Surface all register fields through `manifest.json`. UI
  components stop reading site-config directly for these fields.
  (Partial: manifest already has title/description/owner/languages/etc.
  Need to add `about`, `ref`, `refAliases`, `tags`, `status`,
  `supersedes`, `year`, `logo`.)
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
- Register.yaml resolution (partial): `scripts/generate-data.mjs:1166-1199`
  (most fields consulted; precedence rule is inconsistent across fields)
- `DatasetRegister` (glossarist gem): `lib/glossarist/dataset_register.rb`
- Triggering deployment PRs:
  - geolexica/isotc204-glossary#33 (data)
  - geolexica/isotc204-glossary#34 (per-edition about pages + status fixes —
    needs revision per Option A above)
  - geolexica/isotc204.geolexica.org#28 (deployment config)
