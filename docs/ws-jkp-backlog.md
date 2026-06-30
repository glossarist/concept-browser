# WS J / K / P — Backlog and scope boundaries

This doc records what has landed in concept-browser under the
streamline work, what remains, and where each remaining item
belongs. The binding context is that concept-model is a data-only
repo (per `feedback_model_repos_no_code.md`); many deliverables in
WS J/K/P explicitly call for concept-model changes (shapes, ontology,
test-fixtures) and therefore land upstream before concept-browser
can consume them.

## Status snapshot (2026-06-28)

| WS | Item | Owner | Status |
| -- | ---- | ----- | ------ |
| J1 | PROV-O header on every emitted graph | concept-browser | Done — `src/components/concept-rdf/provenance.ts`, ADR 0007 |
| J2 | `dcat:Dataset` + `skos:ConceptScheme` per dataset | concept-browser | Done — `src/components/concept-rdf/dataset-emitter.ts` + `scripts/lib/dataset-turtle.mjs` wired into `generate-data.mjs` |
| J3 | Concept lifecycle chains (`replaces`/`isReplacedBy`) | concept-browser emitter | Partial — `prov:invalidatedAtTime` emitted for withdrawn/superseded concepts with retired dates. `dcterms:replaces`/`isReplacedBy` deferred pending a URI resolver (the related-concept ref carries source/id, not a URI). |
| J4 | Agent records (foaf:Person, prov:Organization) | concept-model + browser | Pending — concept-model defines vocabulary; browser emits per-dataset |
| J5 | `skos:Collection` grouping from manifest.sections | concept-browser | Done — same dataset emitter produces one `skos:Collection` per section |
| J6 | Dataset versioning records | concept-model | Pending — version entity vocabulary |
| J7 | Build activity records | CI / release | Pending — emits per-CI-run `activity/{run-id}.ttl` |
| J8 | Source/citation provenance (`gloss:ConceptSource`) | concept-browser emitter | Done — `gloss:ConceptSource` (outer) + nested `gloss:Citation` via `gloss:sourceOrigin` per ADR 0009 |
| J9 | Tool identity | concept-model | Pending |
| K1–K5 | Non-verbal entity shapes, image refs, bibliography graph | concept-model | Pending — shapes live upstream |
| K6 | Citation, ConceptRef, Reference MECE classes | concept-browser emitter | Done — ADR 0009 aligns with canonical shapes |
| K7 | Inline references in definition text | concept-browser renderer | Done — `src/utils/content-renderer.ts` |
| K8 | Image variant selection policy | concept-browser renderer | Done — `src/utils/non-verbal-*` |
| P1 | Differential testing (Ruby vs JS) | cross-repo | Pending — needs shared snapshots in concept-model |
| P2 | Mutation testing (stryker / mutation) | concept-browser | Pending — new dev dependency |
| P3 | Fuzz testing (random RDF inputs) | concept-browser | Pending — needs `fast-check` |
| P4 | Snapshot at scale (10 000 concepts) | concept-browser | Pending — fixtures live upstream |
| P5 | Performance trend tracking | CI | Pending |
| P6 | Stress testing (10× largest dataset) | CI | Pending |
| P7 | Ontology self-consistency invariants | concept-model | Pending |

## What's blocking the remaining items

- **Concept-model dependency.** J4, J6, J7, J9, K1–K5, P1, P4, P7
  explicitly require concept-model changes (new shapes, new vocabulary
  declarations, published test-fixtures subpath). The data-only
  constraint means these land as TTL/JSON-LD/YAML data in concept-model
  first, then concept-browser syncs them via `npm run sync:model`.

- **SHACL alignment is now complete.** Layer 4 conformance passes for
  every fixture in the corpus. See `docs/adr/0009-split-concept-source-and-citation.md`
  for the reconciliation record.

- **URI resolver for relationship refs.** J3's `dcterms:replaces` /
  `dcterms:isReplacedBy` needs the related-concept ref
  (`{ source, id }`) turned into an actual concept URI. Today the
  emitter doesn't have a resolver; the relationship is encoded via
  `gloss:hasRelatedConcept` with `gloss:rel/supersedes`, which is
  what the SHACL shapes expect. DCTERMS aliases are an enhancement
  that should land alongside a URI resolver (likely in
  `src/adapters/reference-resolver.ts`).

- **New dev dependencies.** P2 (stryker) and P3 (fast-check) add
  runtime cost to every CI run; these decisions want an explicit
  conversation, not a drive-by addition.

## Build wiring

`scripts/generate-data.mjs` now calls `writeDatasetRdf(register, manifest, concepts, refMaps, opts)`
right after writing `manifest.json`. The output is
`public/data/{register}/{register}.ttl` containing:

- The dataset typed as `dcat:Dataset` + `skos:ConceptScheme`
- `dcterms:title`, `dcterms:description`, `dcterms:modified`,
  `dcterms:identifier`
- One `dcterms:language` IRI per language
- Two `dcat:distribution` blanks (Turtle + JSON-LD)
- `skos:hasTopConcept` for the first 32 concepts (cap keeps the
  document bounded for very large datasets)
- One `skos:Collection` per `manifest.sections` entry with
  `skos:member` per concept in the section
- `prov:wasDerivedFrom`, `dcterms:publisher`, `dcat:contactPoint`
  when the manifest provides them

The build-time `validate-shacl.mjs` walk will pick this file up
automatically. The shape conforms to the canonical SHACL shapes
synced from concept-model.

## What concept-browser can do next without upstream changes

Two follow-up enhancements remain once a URI resolver is wired
into the emitter pipeline:

### Follow-up — DCTERMS lifecycle aliases (J3 remainder)

Map `gloss:rel/supersedes` → `dcterms:replaces` and
`gloss:rel/superseded_by` → `dcterms:isReplacedBy` once the
reference resolver can turn `{ source, id }` into a concept URI.
Likely lives in `src/components/concept-rdf/concept-emitter.ts`,
gated on a new optional `resolveRef` callback parameter.

### Follow-up — Agent records (J4)

When the concept-model vocabulary publishes `foaf:Person` /
`prov:Organization` definitions, emit per-dataset agent records
referenced from `dcterms:publisher` / `dcat:contactPoint` /
`dcterms:contributor`. Today these are opaque IRIs.
