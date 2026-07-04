# PROPOSAL: Single Source of Truth for Dataset Metadata

## Summary

Dataset descriptive metadata currently lives in **four overlapping places**,
with no clear precedence rule. Consumers cannot answer "what is the title of
this dataset?" without knowing which file the question is about, and authors
cannot update a description without editing it in multiple files. This
proposal consolidates dataset metadata into **one source of truth** per
dataset, with deployment repos holding only the layout concerns (where to
fetch the data from).

## Problem

A single dataset today has its title, description, and about-page
information scattered across:

1. **`site-config.yml`** in the deployment repo (`DatasetConfig`):
   - `title`, `description`, `owner`, `color`, `tags`, `ref`, `refAliases`,
     `translations`, `sourceRepo`
   - Used directly by the build pipeline (site-config wins on conflicts).

2. **`register.yaml`** in the dataset itself (`DatasetRegister`):
   - `name` (localized object), `description` (localized object),
     `about` (localized paths to per-edition markdown), `owner`,
     `sourceRepo`, `ref`, `refAliases`, `tags`, `logo`
   - Travels with the dataset inside the GCR.

3. **`pages:` array** in `site-config.yml` (`PageConfig`):
   - One global `about` page per site, source path is in the deployment repo
   - Not dataset-scoped in practice (`datasetScoped` flag exists but is
     rarely set).

4. **`about:` field** in `register.yaml` (localized paths):
   - Per-edition about pages that travel with the dataset
   - Independent of the global `pages:` array

### Symptoms

- **Drift.** Two humans edit the same field in two files. Whichever loads
  last wins at runtime, but neither human knows which.
- **Ambiguity.** `description` on the deployment's `DatasetConfig` (single
  string) and `description` on the dataset's `DatasetRegister` (localized
  object) have the same name but different shapes. Reviewers can't tell
  them apart.
- **Inconsistency.** A dataset deployed to two sites may have different
  descriptions in each deployment's `site-config.yml`, even though the
  underlying dataset is identical. The dataset loses its identity.
- **Loss of provenance.** The dataset's own `about:` page is invisible to
  the global `pages:` config. Two mechanisms for the same concept (an
  "about" page), no documented relationship.

### Concrete example

In the `isotc204-glossary` lineage-series deployment (PRs
[geolexica/isotc204-glossary#33](https://github.com/geolexica/isotc204-glossary/pull/33)
and
[geolexica/isotc204.geolexica.org#28](https://github.com/geolexica/isotc204.geolexica.org/pull/28)),
the same three-line description for each edition must be written into
**both** the deployment's `site-config.yml` AND the dataset's
`register.yaml`. We must also remember to set `status:` correctly per
edition (current vs superseded) in `register.yaml`, but the site-config
doesn't reflect status at all. This is two files that must agree.

The `about:` field in `register.yaml` is a localized path; the `pages:`
array in site-config is a global list with no per-dataset equivalent.
We need both mechanisms because they solve different problems, but they
should agree on the model.

## Proposal

### Principle: dataset-internal metadata is in the dataset; deployment-internal metadata is in the deployment.

Dataset metadata that travels with the data (GCR or local checkout) is
authoritative: `name`, `description`, `about`, `owner`, `sourceRepo`,
`ref`, `refAliases`, `tags`, `logo`, `status`, `supersedes`, `year`,
`languages`, `languageOrder`, `ordering`, `sections`.

Deployment metadata that doesn't travel with the data: `id`, `uri`
(deployment's URI prefix for routing), `gcrPackage` or `localPath` (where
to fetch the data), `color` (deployment-side accent), `datasetGroups`
membership.

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
  sourceRepo?: string;     // for "View source" links (could move to register)

  // Deployment-scoped presentation
  color?: string;          // accent in this site's palette

  // Optional per-deployment override (with explicit semantics)
  overrides?: DatasetOverrides;
}

export interface DatasetOverrides {
  title?: LocalizedText;        // explicit "I am overriding the register's title"
  description?: LocalizedText;
  owner?: string;
  // ... whatever fields a deployment legitimately needs to override
}
```

Anything not in `DatasetConfig` or `DatasetOverrides` is loaded from
`register.yaml` at fetch time and surfaced via `manifest.json`.

#### 2. Make `manifest.json` the runtime SSOT

The build pipeline already emits `manifest.json` per dataset. Make it the
single source that the UI reads for all dataset metadata:

```json
{
  "id": "isotc204-ed3",
  "title": "ISO/TC 204 ITS Vocabulary (Edition 3, draft)",
  "description": "Edition 3 draft, generated from the iso14812 ontology...",
  "about": { "eng": "/data/isotc204-ed3/about-eng.html" },
  "owner": "ISO/TC 204",
  "status": "current",
  "supersedes": "isotc204-2025",
  "year": 2026,
  "ref": "ISO 14812 (Edition 3, draft)",
  ...
}
```

UI components read from manifest only — not from site-config. Site-config
is consumed at build time only.

#### 3. Unify the `about:` mechanism

Remove the global `pages: [{type: 'about', source: 'about.md'}]` array
entry for `about`. Replace with:

- A **per-dataset `about:` field** in `register.yaml` (localized path
  to a markdown file inside the dataset). Becomes a route
  `/dataset/<id>/about`.
- An optional **site-level `about:` field** in `site-config.yml` for
  sites without a single dominant dataset (points at a markdown file
  in the deployment repo). Becomes route `/about`.

Both surface the same way in the UI but are clearly distinguished by
route and source.

#### 4. Drop duplicate fields from `register.yaml` or `site-config.yml`

After the migration, each field appears in exactly one place:

| Field              | Lives in          | Reason                            |
|--------------------|-------------------|-----------------------------------|
| `id`               | both (must match) | deployment references dataset by id |
| `uri`              | site-config       | deployment routing concern         |
| `gcrPackage`/`localPath` | site-config | deployment fetch source         |
| `name`             | register          | dataset's own identity            |
| `description`      | register          | dataset's own identity            |
| `about`            | register          | travels with data                 |
| `owner`            | register          | travels with data                 |
| `sourceRepo`       | register          | travels with data                 |
| `ref`, `refAliases`| register          | travels with data                 |
| `tags`             | register          | travels with data                 |
| `status`           | register          | travels with data                 |
| `color`            | site-config       | deployment accent palette         |
| `datasetGroups`    | site-config       | cross-dataset layout              |

### Migration

- **Step 1**: Add `manifest.json` as the runtime SSOT (already largely
  in place — just confirm the build pipeline copies all register fields
  through).
- **Step 2**: Update UI components to read from manifest only. Currently
  some read from site-config's `DatasetConfig` directly; route them to
  manifest instead.
- **Step 3**: Stop duplicating fields in new deployments. Existing
  deployments keep working (the legacy fields are still respected), but
  documentation steers authors toward the SSOT.
- **Step 4**: Add a `concept-browser doctor` check that flags
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

## Open questions

1. **Should `uri` move to the dataset register?** It's currently
   deployment-specific because it's used as a routing prefix. But the
   URN inside `urn:iso:std:iso:14812:2025:*` IS a dataset property.
   Resolution: keep `uri` as a deployment-side routing template, but
   the dataset's `urn` (in register) is the canonical identity.

2. **What about `color`?** Currently deployment-specific. Could be a
   dataset property if the dataset has a brand color (e.g. OIML blue).
   Tentative answer: keep as deployment override; default to a value
   from register if present.

3. **How does this interact with lineage-series `datasetGroups`?**
   The group itself has a `color` and `label`. The group's metadata
   could move into a "dataset-group" entity file in the deployment
   repo, parallel to the per-dataset register. Out of scope here —
   the group config is a deployment property and stays in site-config.

## References

- Current `DatasetConfig` shape: `src/config/types.ts:85`
- Current `PageConfig` shape: `src/config/types.ts:138`
- `DatasetRegister` (glossarist gem): `lib/glossarist/dataset_register.rb`
- Triggering deployment PRs:
  - geolexica/isotc204-glossary#33 (data)
  - geolexica/isotc204-glossary#34 (per-edition about pages + status fixes)
  - geolexica/isotc204.geolexica.org#28 (deployment config)
