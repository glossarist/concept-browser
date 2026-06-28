# Data Consumers Guide

This document is for **third-party consumers** of Glossarist
concept data — SPARQL endpoints, citation managers, terminology
federators, language tooling, and downstream vocabularies that
ingest or link to concepts served by `@glossarist/concept-browser`
deployments.

A live list of known deployments is maintained in the project
README under **Known deployments**.

## 1. Downloading concept data

Each deployment exposes per-concept and aggregate downloads under
`/data/{register}/`. Replace `{host}` with the deployment's host
(see deployment README).

### Per-concept downloads

```
GET /data/{register}/concepts/{id}.ttl       # Turtle (canonical)
GET /data/{register}/concepts/{id}.jsonld    # JSON-LD
GET /data/{register}/concepts/{id}.json      # Glossarist JSON
GET /data/{register}/concepts/{id}.yaml      # canonical YAML
GET /data/{register}/concepts/{id}.tbx.xml   # TBX-Basic (where available)
```

The `{id}` matches the last path segment of the concept URL. For
example, for
`https://isotc211.geolexica.org/dataset/isotc211/concept/2`, the
Turtle download is at
`https://isotc211.geolexica.org/data/isotc211/concepts/2.ttl`.

### Aggregate downloads

```
GET /data/{register}/index.json              # concept index (id → uri, label)
GET /data/{register}/manifest.json           # dataset metadata, languages, color
GET /data/{register}/edges.json              # cross-reference graph edges
GET /data/{register}/domain-nodes.json       # domain classification tree
```

Index files for large datasets are chunked — see `manifest.json#chunked`
and the per-chunk files under `/data/{register}/chunks/`.

### Canonical RDF

The canonical RDF representation is **Turtle** at the per-concept
URL. The URI minted in the RDF (`{host}/{register}/concept/{id}`)
is the long-term stable identifier (see
[url-stability.md](url-stability.md)).

## 2. Citing Glossarist concepts

For scholarly citation, use the canonical concept URI:

```bibtex
@misc{ISO-TC211-2,
  title        = {geographic information system},
  howpublished = {\url{https://isotc211.geolexica.org/dataset/isotc211/concept/2}},
  note         = {ISO/TC 211 Multi-Lingual Glossary of Terms},
  urldate      = {2026-06-27}
}
```

### Link-rot guidance

- **Cite the canonical URI**, never the `.ttl` / `.jsonld` download
  URL. The canonical URI is permanent; download URLs may shift
  extension sets over major versions.
- **Capture the `dcterms:modified` date** from the concept's RDF.
  This lets you detect whether the concept has changed since you
  cited it.
- **Include the language code** when citing a specific term form.
  The same concept has separate labels per language; "the English
  term for X" and "the French term for X" are different citations.

## 3. Subscribing to dataset changes

Datasets change with each upstream Glossarist release. To stay
current:

1. **Watch the deployment's release feed.** Each deployment
   publishes a GitHub Releases feed (subscribe via RSS). Releases
   list added, modified, withdrawn, and renamed concepts.
2. **Diff the index.** Pull `/data/{register}/index.json` and diff
   against your last-known snapshot. The index file carries an
   `etag`-style hash in `manifest.json#contentHash` for cheap
   change detection.
3. **Re-pull only changed concepts.** The release notes list the
   changed concept IDs; fetch the per-concept `.ttl` for each.

There is no push-based notification service today. If you need
webhooks, file an issue in the deployment repository.

## 4. Validating your tooling against fixtures

The concept-browser repo ships canonical fixtures under
`src/__fixtures__/`:

- `concept-shape.ttl` — a minimal valid concept, useful as a smoke
  test for parsers.
- `shacl/good/concept.ttl` — concepts that **must pass** SHACL
  validation.
- `shacl/bad/concept.ttl` — concepts that **must fail** SHACL
  validation, useful for verifying your validator catches the same
  shape errors we catch.

For your own validation, use the SHACL shapes file at
`data/concept-model/shapes/glossarist.shacl.ttl`. The shapes are
the single source of truth for the canonical concept schema; the
concept-browser build pipeline itself validates against them at
build time (see
[ADR 0005](adr/0005-shacl-validation-gate.md)).

## 5. JSON-LD consumption notes

The deployment emits JSON-LD with a context that intentionally
omits `@container: @set`. As a result:

- **Single-valued predicates appear as scalars** — `"skos:prefLabel": "term"`.
- **Multi-valued predicates appear as arrays** — `"gloss:hasNote": ["a", "b"]`.

When iterating, normalize defensively:

```js
const notes = Array.isArray(node['gloss:hasNote'])
  ? node['gloss:hasNote']
  : node['gloss:hasNote']
    ? [node['gloss:hasNote']]
    : [];
```

The deployment also emits **both** `skos:` and `skosxl:`
predicates for designations (see
[ADR 0004](adr/0004-dual-skos-skosxl.md)). If your tool
round-trips SKOS → SKOS-XL, take care not to double-count labels.

## 6. Provenance and versioning

Every concept RDF includes:

- `dcterms:identifier` — the concept's local ID.
- `dcterms:modified` (where applicable) — last modification date.
- `gloss:hasStatus` — `valid` | `withdrawn` | `supersected` | `draft`.
- `prov:wasGeneratedBy` (planned, see
  `TODO.streamline/10-provenance-and-metadata.md`) — generation
  activity and time.

For withdrawn concepts, the URI still resolves and the RDF carries
`prov:invalidatedAtTime`. Never assume a missing response means
"withdrawn" — always check the status predicate.

## 7. Reporting data issues

For errors in concept data (wrong definition, broken cross-ref,
typo in a designation), file issues against the **source dataset**,
not the deployment. Each deployment's README links to its source
repos. The deployment only re-publishes what the source provides.

For errors in serialization (malformed Turtle, missing JSON-LD
fields, broken URLs), file an issue against
`glossarist/concept-browser`.
