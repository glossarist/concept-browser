# 07 — glossarist-js: sections builder from Quad[] (TODO 33)

## Problem

concept-browser's `src/components/concept-rdf/sections-builder.ts`
takes `RdfGraph` (a subject-grouped custom abstraction) and produces
`ClassInstance[]` for UI rendering:

```ts
interface ClassInstance {
  classId: string;
  classLabel: string;
  label: string;
  props: PropValue[];
}
```

The grouping logic is RDF-structure-driven, not Vue-specific. It
belongs in glossarist-js so any consumer (Vue UI, CLI inspector,
debug tool) can use it. The current coupling to `RdfGraph` blocks
TODO 35 (migrate use-rdf-document) and TODO 36 (delete concept-rdf/).

## Design

Move `buildSections` to glossarist-js as
`quadSectionsToClassInstances(quads, options?)`:

1. Group quads by subject (NamedNode or BlankNode)
2. For each subject:
   - Collect rdf:type values → `classId` (first type)
   - Derive `classLabel` from `classId` local name (CURIE local part)
   - Derive `label` from the subject URI's last path segment, or
     from `skos:prefLabel` / `rdfs:label` if present
   - Collect remaining predicates → `props`
3. For bnode objects, recursively group their triples into nested
   `PropValue.nested = true`
4. Return `ClassInstance[]` sorted by subject IRI (matches current
   insertion-order behavior)

### Label derivation rules

Priority (first non-empty wins):
1. `skos:prefLabel` literal in the requested language
2. `rdfs:label` literal
3. Subject URI's last path segment (`/concept/foo` → `foo`)
4. Subject URI itself

### ClassLabel derivation

From `classId` (e.g., `gloss:Concept`):
1. If CURIE: take local part (`Concept`)
2. If absolute IRI: take last path segment, strip fragment/query

### Options

```ts
interface SectionsBuilderOptions {
  language?: string;  // for skos:prefLabel resolution; default 'eng'
  // Future: label resolver callback for custom label sources
}
```

## Deliverables

- [ ] `src/rdf/sections-builder.js` in glossarist-js
- [ ] Re-export `quadSectionsToClassInstances` from `src/rdf/index.js`
- [ ] Type declarations (`ClassInstance`, `PropValue`, return type)
- [ ] Tests covering:
  - Flat resources (subject + literal/IRI props)
  - Nested bnodes (definition → sources → citation)
  - Multi-type resources (rdf:type list)
  - Multi-valued predicates (same predicate, multiple objects)
  - Label resolution paths (skos:prefLabel, rdfs:label, URI segment)
  - ClassLabel derivation (CURIE, absolute IRI)
- [ ] Drift test: a concept fixture produces sections matching
      concept-browser's current output

## Tests

- A concept's quads produce sections matching the current
      concept-browser output (golden file comparison)
- Bnode nesting recurses correctly
- Multi-valued predicates produce multi-value props
- Missing label falls back through the priority chain
- Empty graph → empty array

## Risk

Medium. The output shape must match concept-browser's Vue components
exactly. A drift here breaks the UI. Mitigation: golden-file test
comparing old-builder output vs new-builder output for the existing
fixtures.
