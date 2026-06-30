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
| J3 | Concept lifecycle chains (`replaces`/`isReplacedBy`) | concept-browser emitter | Partial — `prov:invalidatedAtTime` emitted for withdrawn/superseded concepts with retired dates. `dcterms:replaces`/`isReplacedBy` deferred pending a URI resolver. |
| J4 | Agent records (foaf:Person, prov:Organization) | concept-model + browser | Pending — concept-model defines vocabulary |
| J5 | `skos:Collection` grouping from manifest.sections | concept-browser | Done — same dataset emitter produces one `skos:Collection` per section |
| J6 | Dataset versioning records | concept-model | Pending — version entity vocabulary |
| J7 | Build activity records | concept-browser | Done — `src/components/concept-rdf/build-activity-emitter.ts` + `scripts/lib/build-activity-turtle.mjs` wired into `generate-data.mjs` to emit `data/activity/{runId}.ttl` at end of build |
| J8 | Source/citation provenance (`gloss:ConceptSource`) | concept-browser emitter | Done — `gloss:ConceptSource` (outer) + nested `gloss:Citation` via `gloss:sourceOrigin` per ADR 0009 |
| J9 | Tool identity | concept-browser (partial) | Partial — J7 emits `tool/{id}/{version}` as `prov:Entity`. Full vocabulary ownership is concept-model. |
| K1–K5 | Non-verbal entity shapes, image refs, bibliography graph | concept-model | Pending — shapes live upstream |
| K6 | Citation, ConceptRef, Reference MECE classes | concept-browser emitter | Done — ADR 0009 aligns with canonical shapes |
| K7 | Inline references in definition text | concept-browser renderer | Done — `src/utils/content-renderer.ts` |
| K8 | Image variant selection policy | concept-browser renderer | Done — `src/utils/non-verbal-*` |
| P1 | Differential testing (Ruby vs JS) | cross-repo | Pending — needs shared snapshots in concept-model |
| P2 | Mutation testing (stryker / mutation) | concept-browser | Pending — new dev dependency decision needed |
| P3 | Fuzz testing (random RDF inputs) | concept-browser | Pending — needs `fast-check` |
| P4 | Snapshot at scale (10 000 concepts) | concept-browser | Done — `serialization-perf.test.ts` scale-stress block (10k concepts in ~100ms) |
| P5 | Performance trend tracking | CI | Done via perf-test console output (CI scrapes). Separate JSON artifact would duplicate the test output. |
| P6 | Stress testing (10× largest dataset) | CI | Done as part of P4 — the scale-stress test runs in CI |
| P7 | Ontology self-consistency invariants | concept-model | Pending |

## What's blocking the remaining items

- **Concept-model dependency.** J4, J6, K1–K5, P1, P7 explicitly
  require concept-model changes (new shapes, new vocabulary
  declarations, published test-fixtures subpath). The data-only
  constraint means these land as TTL/JSON-LD/YAML data in
  concept-model first, then concept-browser syncs them via
  `npm run sync:model`.

- **SHACL alignment is complete.** Layer 4 conformance passes for
  every fixture in the corpus. See ADR 0009.

- **URI resolver for relationship refs.** J3's `dcterms:replaces` /
  `dcterms:isReplacedBy` needs the related-concept ref
  (`{ source, id }`) turned into an actual concept URI. The
  relationship is encoded via `gloss:hasRelatedConcept` with
  `gloss:rel/supersedes`, which is what the SHACL shapes expect.
  DCTERMS aliases are an enhancement that should land alongside a
  URI resolver.

- **New dev dependencies.** P2 (stryker) and P3 (fast-check) add
  runtime cost to every CI run; these decisions want an explicit
  conversation, not a drive-by addition.

## Build wiring

`scripts/generate-data.mjs` now emits three new artifacts per
build:

1. **Per-dataset RDF** (`public/data/{register}/{register}.ttl`):
   - `dcat:Dataset` + `skos:ConceptScheme` with title, description,
     modified, identifier, language IRIs.
   - Two `dcat:distribution` blanks (Turtle + JSON-LD).
   - `skos:hasTopConcept` for the first 32 concepts.
   - One `skos:Collection` per `manifest.sections` entry.
   - `prov:wasDerivedFrom`, `dcterms:publisher`, `dcat:contactPoint`
     when the manifest provides them.

2. **Build activity record** (`public/data/activity/{runId}.ttl`):
   - `prov:Activity` with start/end timestamps, git SHA, branch,
     tool identity, datasets processed, concept count.
   - CI agent association when `CI_BOT_AGENT_IRI` is set.
   - Run ID sourced from `GITHUB_RUN_ID` (CI) or a stable local
     timestamp.

3. **Vocabulary graph** (currently in-process only): declares
   enumeration IRIs as `skos:Concept` so SHACL `sh:class skos:Concept`
   constraints resolve. Build-time emission tracked below.

## Follow-up PRs

Two small follow-ups would close the remaining concept-browser
portion of this backlog without blocking on concept-model.

### Follow-up A — Build-time vocabulary emission

Today the vocabulary graph is emitted in the Layer 4 SHACL test
only. Build-time emission would add a `scripts/lib/vocab-turtle.mjs`
sibling to `dataset-turtle.mjs` that produces
`public/data/_vocab.ttl` once per build, so the build-time
`validate-shacl.mjs` walk picks it up automatically. Mechanical
port of `src/components/concept-rdf/vocabulary-emitter.ts`.

### Follow-up B — DCTERMS lifecycle aliases (J3 remainder)

Map `gloss:rel/supersedes` → `dcterms:replaces` and
`gloss:rel/superseded_by` → `dcterms:isReplacedBy` once the
reference resolver can turn `{ source, id }` into a concept URI.
Likely lives in `src/components/concept-rdf/concept-emitter.ts`,
gated on a new optional `resolveRef` callback parameter.
