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
| J2 | `dcat:Dataset` + `skos:ConceptScheme` per dataset | concept-browser generator | Pending — needs a dataset-level emitter in `scripts/generate-data.mjs` |
| J3 | Concept lifecycle chains (`replaces`/`isReplacedBy`) | concept-browser emitter | Pending — needs dcterms:replaces/isReplacedBy + prov:invalidatedAtTime |
| J4 | Agent records (foaf:Person, prov:Organization) | concept-model + browser | Pending — concept-model defines vocabulary; browser emits per-dataset |
| J5 | `skos:Collection` grouping from manifest.sections | concept-browser generator | Pending — extends `generate-data.mjs` |
| J6 | Dataset versioning records | concept-model | Pending — version entity vocabulary |
| J7 | Build activity records | CI / release | Pending — emits per-CI-run `activity/{run-id}.ttl` |
| J8 | Source/citation provenance (`gloss:ConceptSource`) | concept-browser emitter | Done as `gloss:Citation` (ADR 0008); reconciliation with canonical SHACL shapes is tracked in `docs/ws-f-spec-layers.md` |
| J9 | Tool identity | concept-model | Pending |
| K1–K5 | Non-verbal entity shapes, image refs, bibliography graph | concept-model | Pending — shapes live upstream |
| K6 | Citation, ConceptRef, Reference MECE classes | concept-browser emitter | Done — ADR 0008 |
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

- **Canonical SHACL alignment.** Layer 4 probe
  (`src/__tests__/concept-rdf/shacl-conformance.test.ts`) records
  divergences between ADRs 0001–0008 and the canonical shapes. Until
  those are reconciled (a scoped task tracked in
  `docs/ws-f-spec-layers.md`), J2/J3/J5 sit on shaky ground —
  their new emitters should target the canonical shapes, not the
  current emitter's shape.

- **New dev dependencies.** P2 (stryker) and P3 (fast-check) add
  runtime cost to every CI run; these decisions want an explicit
  conversation, not a drive-by addition.

## What concept-browser can do next without upstream changes

Two follow-up PRs would close the realistic concept-browser portion
of this backlog. They are intentionally scoped to land AFTER the
current `feat/ws-d-browser-cleanup` PR merges, so the current PR
stays reviewable:

### Follow-up PR A — Dataset-level RDF (J2, J5)

`scripts/generate-data.mjs` learns to emit one `{shortname}.ttl` per
dataset containing `dcat:Dataset` + `skos:ConceptScheme` metadata and
a `skos:Collection` per `manifest.sections` entry. Source of truth:
`manifest.json` (already produced by the same script).

- New: `scripts/emitters/dataset-emitter.mjs`
- New: `src/__tests__/scripts/dataset-emitter.test.ts` (uses the same
  fixture corpus pattern as `round-trip.test.ts`)
- Updates `public/data/{id}/manifest.json` consumers to expose the new
  dataset TTL URL via the format registry (no per-concept change)

### Follow-up PR B — Concept lifecycle (J3)

The concept emitter learns to translate `related[*].type === 'supersedes'`
and `'superseded_by'` into `dcterms:replaces` / `dcterms:isReplacedBy`,
plus `prov:invalidatedAtTime` when the concept status is `withdrawn`.

- Updates `src/components/concept-rdf/concept-emitter.ts`
- Updates `src/__tests__/concept-rdf/concept-emitter.test.ts`
- New ADR documenting the lifecycle emission policy

Both follow-ups should wait for the SHACL reconciliation
(`docs/ws-f-spec-layers.md` tracking) so the new emitters target the
canonical shapes from day one.
