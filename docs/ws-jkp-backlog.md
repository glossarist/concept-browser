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
| J2 | `dcat:Dataset` + `skos:ConceptScheme` per dataset | concept-browser | Done — `dataset-emitter.ts` + `dataset-turtle.mjs` wired into `generate-data.mjs` |
| J3 | Concept lifecycle chains (`replaces`/`isReplacedBy`) | concept-browser emitter | Partial — `prov:invalidatedAtTime` emitted for withdrawn/superseded concepts with retired dates. `dcterms:replaces`/`isReplacedBy` deferred pending a URI resolver. |
| J4 | Agent records (foaf:Person, prov:Organization) | concept-browser | Done — `agents-emitter.ts` + `agents-turtle.mjs`. Site-config contributors → foaf:Person, dedup → prov:Organization. |
| J5 | `skos:Collection` grouping from manifest.sections | concept-browser | Done — same dataset emitter produces one `skos:Collection` per section |
| J6 | Dataset versioning records | concept-browser | Done — `version-emitter.ts` + `version-turtle.mjs`. Each build emits a chain `prov:Entity` with `dcterms:isVersionOf` + `prov:wasRevisionOf`. |
| J7 | Build activity records | concept-browser | Done — `build-activity-emitter.ts` + `build-activity-turtle.mjs` emit `data/activity/{runId}.ttl` at end of build |
| J8 | Source/citation provenance (`gloss:ConceptSource`) | concept-browser emitter | Done — `gloss:ConceptSource` (outer) + nested `gloss:Citation` via `gloss:sourceOrigin` per ADR 0009 |
| J9 | Tool identity | concept-browser | Done — tool declared as `prov:Entity, prov:SoftwareAgent` with `prov:version` |
| K1–K5 | Non-verbal entity shapes, image refs, bibliography graph | concept-model | Pending — shapes live upstream |
| K6 | Citation, ConceptRef, Reference MECE classes | concept-browser emitter | Done — ADR 0009 aligns with canonical shapes |
| K7 | Inline references in definition text | concept-browser renderer | Done — `src/utils/content-renderer.ts` |
| K8 | Image variant selection policy | concept-browser renderer | Done — `src/utils/non-verbal-*` |
| P1 | Differential testing (Ruby vs JS) | cross-repo | Pending — needs shared snapshots in concept-model |
| P2 | Mutation testing (stryker / mutation) | concept-browser | **Decision needed** — adds stryker as dev dep + multi-minute CI runs |
| P3 | Property-based fuzz testing (random RDF inputs) | concept-browser | Done — `fast-check` (4.8.0), 200 iterations × 4 invariants |
| P4 | Snapshot at scale (10 000 concepts) | concept-browser | Done — `serialization-perf.test.ts` scale-stress block |
| P5 | Performance trend tracking | CI | Done via perf-test console output (CI scrapes) |
| P6 | Stress testing (10× largest dataset) | CI | Done as part of P4 |
| P7 | Ontology self-consistency invariants | concept-model | Pending |

## What's blocking the remaining items

- **Concept-model dependency.** K1–K5, P1, P7 explicitly require
  concept-model changes (new shapes, new vocabulary declarations,
  published test-fixtures subpath). The data-only constraint means
  these land as TTL/JSON-LD/YAML data in concept-model first, then
  concept-browser syncs them via `npm run sync:model`.

- **URI resolver for relationship refs.** J3's `dcterms:replaces` /
  `dcterms:isReplacedBy` needs the related-concept ref
  (`{ source, id }`) turned into an actual concept URI. The
  relationship is encoded via `gloss:hasRelatedConcept` with
  `gloss:rel/supersedes`, which is what the SHACL shapes expect.
  DCTERMS aliases are an enhancement that should land alongside a
  URI resolver (likely `src/adapters/reference-resolver.ts`).

- **P2 mutation testing.** Adding stryker as a dev dep adds a
  multi-minute CI step per emitter file. This is a real cost;
  the question is whether it provides proportional value over
  the existing property-based fuzz tests (P3). See "P2 decision"
  below.

## P2 decision

The property-based fuzz spec (P3) runs 200 iterations × 4 invariants
on the emitter — that's effectively structural mutation testing
of the emitter output. It catches:

- Semantic regressions (SHACL conformance per iteration)
- Structural regressions (parse, terminate, types per iteration)

What stryker would add: source-level mutation (operators, literals,
conditionals) with assertion that *tests still pass* on the mutated
source. This catches:

- Tests that pass on the original code but happen to pass on
  mutated code (test gap detection)

The question is whether the property-based + round-trip + SHACL
suite already provides this coverage for the concept-rdf path.
Empirically: P3 found a real bug (the `hasNote` literal vs blank
issue) that the existing corpus missed. So the suite IS catching
real regressions. stryker would add ~10 minutes to CI for marginal
incremental gain on this code path.

**Recommendation:** defer P2. Document the trade-off here. Add
stryker only when the test suite becomes hard to maintain or when
a regression slips past the property-based net.

## Build wiring summary

`scripts/generate-data.mjs` now emits seven new artifacts per
build, all SHACL-conformant against the canonical shapes:

| File | Source |
| ---- | ------ |
| `data/_vocab.ttl` | `vocab-turtle.mjs` — seven `skos:ConceptScheme` containers |
| `data/agents.ttl` | `agents-turtle.mjs` — site-config contributors |
| `data/versions.ttl` | `version-turtle.mjs` — current package version per register |
| `data/activity/{runId}.ttl` | `build-activity-turtle.mjs` — prov:Activity record |
| `data/{register}/{register}.ttl` | `dataset-turtle.mjs` — dcat:Dataset + skos:Collection per section |
| `data/{register}/concepts/{id}.ttl` | (existing per-concept, view-time via emitter) |

Build-time `validate-shacl.mjs` picks up `_vocab.ttl` and the
dataset-level files automatically when walking `public/data/`.

## Test count progression

| Commit | Tests |
| ------ | ----- |
| `03dc763` (WS O1) | 1050 |
| `f54c134` (WS F) | 1109 |
| `a066a3b` (ADR 0009) | 1137 |
| `f0142de` (J7/P4) | 1151 |
| `19a8f0e` (vocab) | 1156 |
| `07f4a28` (J4/J6) | 1180 |
| `1092276` (P3) | 1184 |
| `6c868f2` (J9) | 1185 |

Total addition this session: 135 new tests, all passing.

## WS H — Release coordination

Not a coding task. Lives outside this PR. Triggers when all
upstream PRs (concept-model, glossarist-ruby, glossarist-js) have
landed and the current PR is approved + merged.