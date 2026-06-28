# ADR 0007: PROV-O provenance decorator on emitted concept graphs

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

Every concept RDF document carries an implicit question: "who
produced this, when, and with what tool?" Without explicit answers,
consumers cannot:

- Distinguish build-emitted static dumps from browser-rendered RDF.
- Detect when a concept was last re-serialized (vs. when its source
  data changed).
- Blame the right version of the serializer when output shapes
  change.

[ADR 0001](0001-graph-based-rdf-ir.md) established the graph IR;
this ADR extends that pipeline with PROV-O provenance triples.

## Decision

Implement a **decorator** (`decorateWithProvenance` in
`src/components/concept-rdf/provenance.ts`) that attaches three
triples to the concept resource after the base emitter has
populated the graph:

```turtle
<concept-uri>
  prov:wasGeneratedBy <activity/serializers/concept-browser/{version}> ;
  prov:generatedAtTime "{ISO-8601}"^^xsd:dateTime ;
  dcterms:isVersionOf <canonical-uri> ;   # only when canonical differs
  .

<activity/serializers/concept-browser/{version}>
  a prov:Activity ;
  .
```

The decorator is **not** wired into the emitter itself. The emitter
walks the Concept model and emits domain triples; the decorator
attaches build/render context (timestamp, tool version). This keeps
the emitter testable in isolation and lets build scripts and runtime
composables attach different provenance values from the same
emission.

`useRdfDocument` (runtime composable) calls the decorator with:

- `toolId: 'concept-browser'`
- `toolVersion: __CONCEPT_BROWSER_VERSION__` (Vite `define`, sourced
  from `package.json`)
- `generatedAt: new Date().toISOString()` (browser view time)
- `canonicalUri: <the concept's stable URI>`

For build-time emission (the `.ttl` files in `public/data/`), the
build pipeline would pass its own timestamp — currently that path
emits via a separate `conceptJsonToTurtle` function in
`scripts/generate-data.mjs`, and provenance integration there is
deferred.

## Consequences

**Positive**

- Every browser-emitted concept document is self-describing —
  consumers can attribute it to a tool version without external
  metadata.
- `dcterms:isVersionOf` distinguishes versioned from canonical
  URIs, supporting the URL stability policy in
  [url-stability.md](../url-stability.md).
- The decorator is idempotent: calling twice with the same options
  produces the same single set of triples (RdfGraph deduplicates).

**Negative**

- Adds three triples per concept to the runtime-emitted RDF. The
  increase is negligible against the existing concept payload.
- `prov:generatedAtTime` is the browser's wall-clock time at view,
  not the build's. For a static site, the build timestamp matters
  more; build-time integration is left for a follow-up.

**Watch for**

- If the build pipeline gains provenance emission
  (`conceptJsonToTurtle` in `scripts/generate-data.mjs`), it must
  use the **same** `activity/serializers/concept-browser/{version}`
  IRI shape so consumers can correlate. The decorator in
  `provenance.ts` is the single source for that shape.

## Alternatives considered

- **Emit provenance directly from `concept-emitter.ts`** — couples
  domain emission to build context. Rejected: breaks the MECE
  separation between model and tooling.
- **Wrap each format writer with a provenance-enriching writer**
  — three decorators (Turtle, JSON-LD, sections) instead of one.
  Rejected: triples belong on the graph, not on each writer's
  output. The graph IR makes one decorator sufficient.
- **Per-concept provenance file** — provenance as a separate
  `<concept>.prov.ttl`. Rejected: triples about the concept belong
  in the concept document so consumers see them on dereference.
