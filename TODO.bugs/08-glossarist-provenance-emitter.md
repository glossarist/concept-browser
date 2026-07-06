# 08 — glossarist-js: provenance emitter (TODO 34)

## Problem

concept-browser's `src/components/concept-rdf/provenance.ts` attaches
runtime provenance quads to a concept resource at view-time (when a
user opens a concept in the browser). The logic is RDF-structure-
driven and belongs in glossarist-js so any consumer can attach
provenance uniformly.

Currently the function lives in concept-browser and operates on its
`RdfGraph` abstraction. Once glossarist-js has it, concept-browser's
copy is dead code.

## Design

Add `provenanceToQuads(input)` to glossarist-js:

```ts
interface ProvenanceInput {
  subjectUri: string;        // the resource being provenance-tagged
  serializer: string;        // e.g., "concept-browser"
  serializerVersion: string; // e.g., "0.7.66"
  generatedAt: string;       // ISO 8601 date-time
  canonicalUri?: string;     // for dcterms:isVersionOf (versions)
}
```

Emits:

```turtle
<subjectUri>
  a prov:Entity ;
  prov:wasGeneratedBy <activity/serializers/{serializer}/{version}> ;
  prov:generatedAtTime "{generatedAt}"^^xsd:dateTime ;
  dcterms:isVersionOf <canonicalUri> .   # only if canonicalUri set

<activity/serializers/{serializer}/{version}>
  a prov:Activity ;
  rdfs:label "{serializer} {version}" ;
  prov:wasAssociatedWith [
    a prov:SoftwareAgent ;
    foaf:name "{serializer}" ;
    prov:version "{version}"
  ] .
```

This matches the current concept-browser output exactly (verified
against `decorateWithProvenance` + `runtimeProvenance`).

## Design notes

- **Subject-relative activity IRI.** The activity is identified by
  `{serializer}/{version}`, relative to the document base. concept-browser
  prepends `activity/serializers/` to namespace it.
- **Blank node for the software agent.** The agent is per-emission
  (every concept gets its own agent bnode) — matches current
  behavior. If consumers want a single shared agent IRI, that's a
  future parameter.
- **No crypto.** Bnode IDs are content-addressed via
  `deterministicBnodeId(subjectUri, serializer, version)` for
  stability across runs.

## Deliverables

- [ ] `src/rdf/provenance-emitter.js` in glossarist-js
- [ ] Re-export from `src/rdf/index.js`
- [ ] Type declarations
- [ ] Tests:
  - Emits prov:wasGeneratedBy link
  - Activity typed as prov:Activity
  - Agent typed as prov:SoftwareAgent + foaf:name
  - generatedAtTime is xsd:dateTime typed literal
  - isVersionOf emitted only when canonicalUri !== subjectUri
  - Idempotent (same input → same bnode IDs)

## Tests

Round-trip: emit, parse with n3, assert each expected quad is
present. Mirror the test shape of the existing emitters
(`test/rdf/build-activity-emitter.test.js`).

## Downstream

Once this lands + sections-builder (TODO 07), concept-browser's
`provenance.ts` becomes a one-line wrapper around this emitter. The
`RdfGraph` decorator pattern goes away.
