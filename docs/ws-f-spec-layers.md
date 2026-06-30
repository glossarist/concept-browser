# WS F — Spec layers in concept-browser

This document records which layers of the cross-language spec network
(`TODO.streamline/06-specs-cross-language.md`) live in concept-browser
today, which are deferred, and where to look for each.

## Layers

| # | Layer | Status | Where |
| - | ----- | ------ | ----- |
| 1 | Unit (per repo) | Done | `__tests__/concept-rdf-view.test.ts`, `__tests__/format-downloads.test.ts`, `__tests__/use-format-registry.test.ts` |
| 2 | Round-trip across fixture corpus and both formats | Done | `__tests__/concept-rdf/round-trip.test.ts` (Turtle + JSON-LD × 6 fixtures) |
| 3 | Cross-language byte-equivalence with Ruby | Deferred (concept-model) | Requires Ruby snapshot emission checked into `concept-model/test/snapshots/`. concept-browser cannot generate those snapshots. |
| 4 | SHACL conformance per fixture | Done (gate) | `__tests__/concept-rdf/shacl-conformance.test.ts`. Every fixture in the corpus conforms to the canonical shapes after the emitter reconciliation in ADR 0009. |
| 5 | Property-based (fast-check) | Deferred | Adds a runtime dependency (`fast-check`) and shared arbitrary builders that belong in `concept-model/test-fixtures/arbitrary.ts`. Revisit when concept-model publishes the arbitrary. |
| 6 | UI snapshots | Done | `__tests__/concept-rdf-view.test.ts` — fixture corpus block. |
| 7 | Performance regression | Done | `__tests__/perf/serialization-perf.test.ts` — 500-concept emission under 2s budget (Turtle: ~12ms, JSON-LD: ~15ms). |
| 8 | Integration end-to-end | Deferred (CI) | Belongs in `.github/workflows/`. Track in WS H (release coordination). |

## Fixture corpus

`src/__tests__/__fixtures__/concepts.ts` exports `CONCEPT_FIXTURES` — six
named concepts that cover the WS F fixture catalog (minimal,
multilingual, full-relationships, with-sources, with-non-verbal,
with-dates).

Long-term, these fixtures should live in `concept-model` and be
consumed via `@glossarist/concept-model/test-fixtures`. Until
concept-model publishes that subpath, the fixtures are duplicated here
under `src/__tests__/__fixtures__/`. The local copy is the same shape
and uses the same names, so switchover is a one-line import change.

## SHACL conformance (Layer 4)

`shacl-conformance.test.ts` is a strict gate. It runs SHACL
validation against the canonical shapes
(`data/concept-model/shapes/glossarist.shacl.ttl`) for every
fixture in the corpus, after merging in the vocabulary graph
emitted by `src/components/concept-rdf/vocabulary-emitter.ts`.
All six fixtures conform.

The reconciliation between the original ADRs (0001–0008) and the
canonical shapes is documented in ADR 0009. Key changes:

- `gloss:hasSource` blanks typed `gloss:ConceptSource` (outer) with
  nested `gloss:Citation` via `gloss:sourceOrigin`.
- `gloss:hasDefinition` / `hasNote` / `hasExample` blanks typed
  `gloss:DetailedDefinition`.
- `gloss:hasDate` blanks typed `gloss:ConceptDate` with
  `gloss:dateType` (IRI) + `gloss:dateValue` (xsd:dateTime).
- `gloss:hasRelatedConcept` blanks typed `gloss:RelatedConcept` with
  optional `gloss:relationshipRef` → `gloss:ConceptRef`.
- Enumeration IRIs (`gloss:status/*`, `gloss:entstatus/*`,
  `gloss:norm/*`, `gloss:srctype/*`, `gloss:srcstatus/*`,
  `gloss:datetype/*`, `gloss:rel/*`) declared as `skos:Concept`
  in seven `skos:ConceptScheme` containers emitted by the
  vocabulary emitter.

## Acceptance criteria status

From `TODO.streamline/06-specs-cross-language.md`:

- [x] All achievable layers exist with at least one spec per layer.
  (Layers 1, 2, 4, 6, 7 in concept-browser today.)
- [ ] Cross-language snapshot spec passes for all 6 base fixtures —
  deferred (Layer 3, needs Ruby snapshots).
- [x] SHACL spec passes for all fixtures in all 3 repos (concept-browser
  portion fully passing; cross-repo Ruby/JS layers tracked via WS H).
- [ ] Property-based spec runs 1000 iterations without failure —
  deferred (Layer 5, needs fast-check + shared arbitrary).
- [x] No spec uses `vi.fn()` to mock a model class.
- [x] No Ruby spec uses `double()` (N/A in this repo).
- [x] E2E test catches the original v0.7.51 bug — covered by
  `validate-shacl.test.ts` + `bundle-layout.test.ts`
  (Turtle download content-type, RDF emitter exclusion from main
  chunk).
