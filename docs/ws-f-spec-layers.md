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
| 4 | SHACL conformance per fixture | Probe only | `__tests__/concept-rdf/shacl-conformance.test.ts`. See "SHACL divergence" below. |
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

## SHACL divergence (Layer 4)

`shacl-conformance.test.ts` is a **probe**, not a gate. It runs SHACL
validation against the canonical shapes
(`data/concept-model/shapes/glossarist.shacl.ttl`) and prints a
structured divergence report. It does not fail the build.

The probe currently records violations on these paths:

- `gloss:hasStatus`, `gloss:hasEntryStatus` — shapes require the value
  IRI to be a `skos:Concept` instance; the emitter uses bare IRIs
  (`gloss:status/valid`, `gloss:entstatus/valid`) without vocabulary
  declarations.
- `gloss:hasDefinition`, `gloss:hasNote`, `gloss:hasExample` — shapes
  require blank nodes typed `gloss:DetailedDefinition`; the emitter
  emits `[ rdf:value "..." ]` without a type.
- `gloss:hasSource` — shapes require `gloss:ConceptSource`; the
  emitter types the blank as `gloss:Citation` (ADR 0008).
- `gloss:hasDate` — shapes require `gloss:ConceptDate` with
  `gloss:dateType`/`gloss:dateValue`; the emitter emits
  `[ rdf:value "type: date" ]`.
- `gloss:hasRelatedConcept` — shapes require `gloss:RelatedConcept`
  type on the blank; the emitter omits the type triple.

### Why a probe, not a fix

Reconciling the emitter with the canonical shapes is its own
workstream: it supersedes parts of ADR 0008, restructures the
definition/note/example/date emitters, and adds a vocabulary emitter
that declares `gloss:status/*`, `gloss:entstatus/*`, `gloss:norm/*`,
and `gloss:rel/*` as `skos:Concept` instances. That work should be
scoped and tracked separately so it can be reviewed alongside the
concept-model shapes and the Ruby/JS emitters (cross-repo
consistency).

### Tracking

Follow-up: track in WS Q (architectural refinements) under
"SHACL alignment". When the emitter conforms, flip the probe to a
strict gate by replacing the summary recording with
`expect(report.conforms).toBe(true)`.

## Acceptance criteria status

From `TODO.streamline/06-specs-cross-language.md`:

- [x] All achievable layers exist with at least one spec per layer.
  (Layers 1, 2, 4-as-probe, 6, 7 in concept-browser today.)
- [ ] Cross-language snapshot spec passes for all 6 base fixtures —
  deferred (Layer 3, needs Ruby snapshots).
- [ ] SHACL spec passes for all fixtures in all 3 repos — probe only
  in concept-browser; see divergence note above.
- [ ] Property-based spec runs 1000 iterations without failure —
  deferred (Layer 5, needs fast-check + shared arbitrary).
- [x] No spec uses `vi.fn()` to mock a model class.
- [x] No Ruby spec uses `double()` (N/A in this repo).
- [x] E2E test catches the original v0.7.51 bug — covered by
  `validate-shacl.test.ts` + `bundle-layout.test.ts`
  (Turtle download content-type, RDF emitter exclusion from main
  chunk).
