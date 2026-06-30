# ADR 0009: Split ConceptSource and Citation to match canonical SHACL shapes

- **Status**: Accepted
- **Date**: 2026-06-28
- **Supersedes**: [ADR 0008 — Structured citation emission](0008-structured-citation-emission.md)

## Context

ADR 0008 typed every concept source blank node as `gloss:Citation`
and inlined the structured fields directly on it:

```turtle
<concept> gloss:hasSource [
  a gloss:Citation ;
  dcterms:bibliographicCitation "ISO 704 3.1" ;
  gloss:sourceStatus gloss:srcstatus/identical ;
  gloss:sourceType   gloss:srctype/authoritative ;
  gloss:modificationNote "revised 2024" ;
  gloss:conceptSource [ a gloss:CitationRef ; gloss:source "ISO 704" ; ... ] ;
  gloss:citationLocality [ a gloss:Locality ; ... ] ;
  rdfs:seeAlso <link> ;
  gloss:original "Original wording" ;
] .
```

The WS F Layer 4 SHACL probe
(`src/__tests__/concept-rdf/shacl-conformance.test.ts`) runs every
fixture through the canonical shapes synced from `concept-model`
at `data/concept-model/shapes/glossarist.shacl.ttl`. The probe
recorded violations against `gloss:hasSource`, `gloss:hasDate`,
`gloss:hasDefinition`, `gloss:hasEntryStatus`, `gloss:hasStatus`,
and `gloss:hasRelatedConcept`.

The canonical shapes encode a different ontology than ADR 0008
assumed:

- `gloss:hasSource` requires `sh:class gloss:ConceptSource`, not
  `gloss:Citation`. `ConceptSource` and `Citation` are distinct
  classes with distinct shapes.
- `gloss:ConceptSource` carries `sourceType`, `sourceStatus`,
  `modification`, and a `sourceOrigin` pointer to a separate
  `gloss:Citation` blank node.
- `gloss:Citation` carries `hasCitationRef`, `hasCitationLocality`,
  `citationLink`, `citationOriginal`.
- `gloss:DetailedDefinition` is required on every definition, note,
  and example blank.
- `gloss:ConceptDate` is required on every date blank, with
  `gloss:dateType` (IRI) and `gloss:dateValue` (`xsd:dateTime`).
- `gloss:RelatedConcept` is required on every related-concept blank,
  with `gloss:relationshipRef` pointing at a `gloss:ConceptRef`.
- Status / entry-status / normative-status / source-type /
  source-status / date-type / relationship-type IRIs must be
  `skos:Concept` instances for `sh:class skos:Concept` constraints
  to resolve.

## Decision

Align the emitter with the canonical shapes. Specifically:

1. **Split `ConceptSource` and `Citation`**. The outer blank node
   on `gloss:hasSource` is typed `gloss:ConceptSource` and carries
   the four `ConceptSource` predicates. The bibliographic content
   moves to a nested `gloss:Citation` blank under `gloss:sourceOrigin`.

2. **Rename predicates to match the ontology**:

   | ADR 0008 | Canonical (this ADR) |
   | -------- | -------------------- |
   | `gloss:modificationNote` | `gloss:modification` |
   | `gloss:conceptSource` (on source) | `gloss:sourceOrigin` |
   | `gloss:source` (on CitationRef) | `gloss:citationRefSource` |
   | `gloss:refn` | `gloss:citationRefId` |
   | `dcterms:date` (on CitationRef) | `gloss:citationRefVersion` |
   | `gloss:citationLocality` | `gloss:hasCitationLocality` |
   | `rdfs:seeAlso` (link) | `gloss:citationLink` (literal `xsd:anyURI`) |
   | `gloss:original` | `gloss:citationOriginal` |

3. **Type every blank node the shapes target**:

   | Path | Type |
   | ---- | ---- |
   | `gloss:hasDefinition` | `gloss:DetailedDefinition` |
   | `gloss:hasNote` | `gloss:DetailedDefinition` |
   | `gloss:hasExample` | `gloss:DetailedDefinition` |
   | `gloss:hasDate` | `gloss:ConceptDate` |
   | `gloss:hasRelatedConcept` | `gloss:RelatedConcept` |
   | (image-backed) `gloss:hasNonVerbalRep` | `gloss:NonVerbalRepresentation` |

4. **Restructure dates**. `gloss:hasDate` now carries
   `gloss:dateType` (IRI like `gloss:datetype/accepted`) and
   `gloss:dateValue` (`xsd:dateTime` literal). Date-only strings
   like `2020-01-15` are coerced to `2020-01-15T00:00:00Z`.

5. **Restructure related concepts**. The `gloss:hasRelatedConcept`
   blank carries `gloss:relationshipType` (IRI) and an optional
   `gloss:relationshipRef` pointing at a nested `gloss:ConceptRef`
   blank with `gloss:conceptRefSource` and `gloss:conceptRefId`.

6. **Non-verbal reps**. Image-backed NVRs are typed
   `gloss:NonVerbalRepresentation` and carry `gloss:representationType`
   (canonical: `"image"` | `"table"` | `"formula"`) and
   `gloss:representationRef` (`xsd:anyURI` literal).
   `figure` is normalized to `image` to satisfy the shape's
   `sh:in ("image" "table" "formula")` constraint.
   NVRs without a stable URI (e.g. inline formulae with no image)
   fall back to `gloss:DetailedDefinition` so they don't fail the
   `representationRef minCount 1` constraint.

7. **Vocabulary emitter**. A new
   `src/components/concept-rdf/vocabulary-emitter.ts` produces a
   `skos:ConceptScheme` graph that declares every enumeration IRI
   used by the emitter (`gloss:status/*`, `gloss:entstatus/*`,
   `gloss:norm/*`, `gloss:srctype/*`, `gloss:srcstatus/*`,
   `gloss:datetype/*`, `gloss:rel/*`) as a `skos:Concept`. The
   Layer 4 test merges this graph with each fixture's data so
   `sh:class skos:Concept` constraints resolve. The build-time
   `scripts/validate-shacl.mjs` will pick the vocab file up
   automatically once it is emitted into `public/data/`.

## Consequences

**Positive**

- Layer 4 SHACL conformance passes for every fixture in the
  concept-browser corpus. The probe at
  `src/__tests__/concept-rdf/shacl-conformance.test.ts` is now
  a strict gate, not a divergence report.
- The emitter and the canonical ontology now agree. Cross-language
  byte equivalence with Ruby (WS F Layer 3) becomes achievable
  because both sides target the same shapes.
- The structured citation model is richer: `ConceptSource`
  (provenance) is cleanly separated from `Citation` (bibliographic
  record). Round-tripping back to a `ConceptSource` model instance
  is still mechanical.

**Negative**

- Per-source payload grows: every source now has an outer
  `ConceptSource` blank, a nested `Citation` blank, and (when
  present) nested `CitationRef` and `Locality` blanks. Acceptable
  — concepts typically have 1–3 sources.
- Consumers that read ADR 0008 predicates (`gloss:modificationNote`,
  `gloss:conceptSource`, `gloss:citationLocality`, `gloss:original`,
  `gloss:source`, `gloss:refn`, `rdfs:seeAlso` for the link) will
  need to switch. This is the canonical shape, so the rename is
  one-way.
- Inline formulae without an image URI are typed
  `gloss:DetailedDefinition` rather than
  `gloss:NonVerbalRepresentation`. They lose the canonical NVR
  typing until the upstream shape relaxes `representationRef
  minCount 1` (tracked in `docs/ws-jkp-backlog.md`).

**Watch for**

- The vocabulary graph is currently emitted into the in-process
  SHACL test only. The build pipeline must also emit a
  `vocab.ttl` next to per-concept Turtle so the build-time
  `validate-shacl.mjs` walk picks it up. Tracked in
  `docs/ws-jkp-backlog.md` under Follow-up PR A.

## Alternatives considered

- **Loosen the shapes to match ADR 0008.** Rejected: the shapes
  live in the `concept-model` repo and encode the canonical
  Glossarist ontology. Concept-browser does not own them.
- **Emit both the old and new predicates.** Rejected as a DRY
  violation; the two would drift, and consumers would have to
  decide which to trust.
- **Skip the type triples and hope `sh:class` resolves
  implicitly.** Rejected: SHACL `sh:class` requires the value
  node to have an `rdf:type` triple in the validated data. There
  is no implicit resolution.
