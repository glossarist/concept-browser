# ADR 0008: Structured citation emission for concept sources

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

Until v0.7.51, every concept source (`ConceptSource`) was emitted as
a single `rdf:value` literal containing the formatted citation
string:

```turtle
<concept> gloss:hasSource [ rdf:value "ISO 704 3.1" ] .
```

This loses every structured field the model carries:

- `ConceptSource.status` — identical / modified / restyled / adapted
- `ConceptSource.type` — authoritative / lineage
- `ConceptSource.modification` — free-text modification note
- `Citation.ref` — `{ source, id, version }` (the standard, the
  clause, the edition)
- `Citation.locality` — `{ type, referenceFrom, referenceTo }` (the
  cited location within the source)
- `Citation.link` — URL to the source document
- `Citation.original` — the original wording before modification

Consumers that want to (e.g.) group concepts by source standard, or
link a citation to a bibliographic record, must re-parse the
formatted string — defeating the point of RDF.

## Decision

Replace the single-literal emission with a **structured blank node**
of type `gloss:Citation`, carrying every field the model exposes:

```turtle
<concept> gloss:hasSource [
  a gloss:Citation ;
  dcterms:bibliographicCitation "ISO 704 3.1" ;
  gloss:sourceStatus gloss:srcstatus/identical ;
  gloss:sourceType   gloss:srctype/authoritative ;
  gloss:modificationNote "revised 2024" ;
  gloss:conceptSource [
    a gloss:CitationRef ;
    gloss:source  "ISO 704" ;
    gloss:refn    "3.1" ;
    dcterms:date  "2020" ;
  ] ;
  gloss:citationLocality [
    a gloss:Locality ;
    gloss:localityType  "clause" ;
    gloss:referenceFrom "3.1" ;
  ] ;
  rdfs:seeAlso   <https://example.org/iso-704> ;
  gloss:original "Original wording" ;
] .
```

Implementation:

- New predicates in `predicates.ts`: `GLOSS.Citation`,
  `GLOSS.CitationRef`, `GLOSS.Locality`, `GLOSS.source`,
  `GLOSS.refn`, `GLOSS.sourceStatus`, `GLOSS.sourceType`,
  `GLOSS.modificationNote`, `GLOSS.localityType`,
  `GLOSS.referenceFrom`, `GLOSS.referenceTo`, `GLOSS.original`,
  `GLOSS.citationLocality`.
- New `RDF.type` predicate and `RDFS.seeAlso` / `RDFS.label`
  constants for typed blank nodes and external links.
- `sourceTriples(s: ConceptSource)` is the single emitter for both
  concept-level and localized sources. The function is private to
  `concept-emitter.ts` because it is the only call site.

### Backward compatibility

The formatted bibliographic string is preserved as
`dcterms:bibliographicCitation`. Consumers that read
`rdf:value` will need to switch to the new predicate — but the
information is the same and the change is one find/replace.

The legacy `rdf:value` was dropped because the new `dcterms:`
predicate is the canonical Dublin Core term for exactly this
purpose. Keeping both would be a DRY violation and would let the
two drift.

## Consequences

**Positive**

- Consumers can SPARQL for "concepts sourced from ISO 704:2020"
  without parsing formatted strings.
- The status / type IRIs (`gloss:srcstatus/identical`,
  `gloss:srctype/authoritative`) are vocabulary terms, so they
  can be enumerated, validated by SHACL, and discovered by SKOS.
- Nested `gloss:CitationRef` and `gloss:Locality` blank nodes
  preserve the model's structure 1:1 — round-tripping back to a
  `ConceptSource` is mechanical.

**Negative**

- Per-source payload is larger. Acceptable — concepts typically
  have 1-3 sources; the per-concept overhead is small.
- `dcterms:bibliographicCitation` plus structured fields is
  technically redundant. We accept this: the formatted string is
  the *presentation* form, the structured fields are the *data*
  form. Both have consumers.

**Watch for**

- The status/type/locality vocabularies (`gloss:srcstatus/...`,
  `gloss:srctype/...`) should be declared as SKOS ConceptSchemes
  in the concept-model ontology. Today they are emitted as IRIs
  without an ontology definition; a follow-up task is to add them.

## Alternatives considered

- **First-class bibliography resources** (K5 spec) — promote each
  citation to a named `<bib/{id}>` resource rather than a blank
  node. Rejected for now: requires a dataset-scoped bibliography
  index, which is a concept-model responsibility. The current
  blank-node shape is forward-compatible — when named bib
  resources ship, the blank node becomes an IRI pointing at one.
- **Keep `rdf:value` for backward compat** — see above. Replaced
  by `dcterms:bibliographicCitation` to avoid maintaining two
  copies of the same string.
