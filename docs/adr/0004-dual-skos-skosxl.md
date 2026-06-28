# ADR 0004: Emit both `skos:` and `skosxl:` predicates

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

SKOS-XL (`skosxl:`) is the canonical model for representing
**designations as first-class resources** with their own metadata
(grammar info, part of speech, pronunciation, international/absent
flags). Glossarist designations carry all of this — so SKOS-XL is
the natural fit.

Plain SKOS (`skos:`) represents designations only as literals
attached to the concept:

```
ex:concept skos:prefLabel "atomic data unit"@eng .
```

Many SKOS consumers (general-purpose RDF libraries, SPARQL
endpoints, triplestores with default shapes) do not understand
SKOS-XL. If we emit only `skosxl:`, those consumers see concepts
with no labels at all.

## Decision

For every designation, emit **both**:

1. A `skosxl:Label` resource with full metadata (literalForm,
   normativeStatus, grammarInfo, pronunciation, etc.).
2. A parallel `skos:prefLabel` or `skos:altLabel` literal on the
   localized concept, mirroring the designation text and language
   tag.

```turtle
ex:concept/eng a gloss:LocalizedConcept, skos:Concept ;
  skosxl:prefLabel ex:concept/eng/desig/atomic_data_unit ;
  skos:prefLabel "atomic data unit"@eng .

ex:concept/eng/desig/atomic_data_unit a skosxl:Label ;
  skosxl:literalForm "atomic data unit"@eng ;
  gloss:normativeStatus gloss:norm/preferred .
```

The choice between `skos:prefLabel` and `skos:altLabel` follows the
designation's `normativeStatus` — `preferred` → prefLabel, anything
else → altLabel.

## Consequences

**Positive**

- Plain-SKOS consumers see complete labels and definitions.
- SKOS-XL-aware consumers get the full designation graph with
  grammar, pronunciation, and provenance.
- SPARQL queries against either vocabulary work.

**Negative**

- Output is roughly 2× the size for the designation portion. This
  is acceptable; designations are a small fraction of total triples.
- Authoring tools that try to "round-trip" SKOS → SKOS-XL may
  double-count labels. We document this in
  [data-consumers.md](../data-consumers.md).

**Alternatives considered**

- **SKOS-XL only** — clean but locks out generic SKOS tooling.
- **SKOS only** — loses all the designation metadata that
  Glossarist exists to capture. Non-starter.
- **Configurable emission** — adds a knob nobody needs. The dual
  emission is the right default for a terminology browser.
