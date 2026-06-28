# ADR 0001: Graph-based RDF intermediate representation

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

Until v0.7.51 the `ConceptRdfView` pipeline produced three independent
projections of the same Concept model:

1. **UI sections** — `conceptInstance` / `localizedInstance` /
   `designationInstance` plain objects built inline in
   `use-rdf-document.ts` (~418 lines).
2. **Turtle** — `writeToTurtle(concept)` walked the model a second time
   and emitted triples directly.
3. **JSON-LD** — `writeToJsonld(concept)` walked the model a third
   time and emitted nested JSON objects.

Each path independently decided which predicates to emit, how to
deduplicate values, and how to order output. This produced real bugs:

- Turtle and JSON-LD silently dropped fields that sections rendered
  (notes, examples, sources) because the three walkers drifted apart.
- Adding a new field required touching all three places — a textbook
  DRY violation that the test suite could not catch (each format had
  its own narrow tests).
- Turtle emission used `gloss:status/valid` style IRIs that violate
  the Turtle 1.1 PN_LOCAL grammar (unescaped `/`); the regex-based
  tests did not catch it because they were not round-tripping through
  a real parser.

## Decision

Introduce a single subject-grouped triple IR — `RdfGraph` — that is
the **only** output of model emission. Three thin writers project the
same graph into the formats callers need:

```
Concept ──emitConceptGraph──▶ RdfGraph ──┬── writeTurtle ──▶ string
                                          ├── writeJsonLd ──▶ string
                                          └── buildSections ──▶ ClassInstance[]
```

`RdfGraph` (see `src/components/concept-rdf/rdf-graph.ts`):

- Discriminated union `RdfTerm = iri | literal | blank` where `blank`
  carries its own triples — recursive structures (sources, related
  concepts, non-verbal reps) nest naturally.
- Map insertion-order preserved so output is deterministic.
- `ResourceWriter.add()` deduplicates `(predicate, object)` pairs at
  insertion time; writers do not re-dedupe.
- `declare(subject, init)` returns the writer for a subject so chains
  read top-to-bottom: `g.declare(uri, {...}).literal(...).iri(...)`.

`concept-emitter.ts` walks the Concept model exactly once and
populates the graph. Adding a predicate touches **one** line in
**one** file.

## Consequences

**Positive**

- One emission site — adding a field is a single-line change.
- All three projections stay in sync by construction.
- Round-trip tests (n3 → Store → assertions) verify Turtle is
  syntactically valid, not just regex-plausible.
- Deterministic ordering makes diffs reviewable and snapshots stable.
- Test count grew from 955 → 1019 with the new graph-IR suites; no
  prior coverage lost.

**Negative**

- Adds one layer of indirection between the model and the wire format.
  Readers chasing a specific predicate must hop emitter → graph →
  writer instead of grepping a single function.
- The graph IR is in-memory; for very large aggregates (whole
  dataset dumps) this is more memory than streaming emission. See
  [ADR 0006](0006-lazy-load-serializer.md) and the streaming ADR
  that supersedes this if/when aggregates ship.

**Mitigations**

- The IR is a single file (~190 lines) with strong types — easy to
  read in one sitting.
- Writers are pure functions of the graph; they can be tested in
  isolation without instantiating a Concept.

## Alternatives considered

- **Visitor pattern over the model** — would decouple emission from
  the model class itself, but for one consumer (this emitter) the
  dispatch overhead is unjustified. Revisit if more than one visitor
  materializes.
- **`@rdfjs/dataset` as the IR** — heavier dependency than needed
  here; the in-house IR is purpose-built for subject-grouped output
  and recursive blank nodes.
