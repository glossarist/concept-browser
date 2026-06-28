# Architectural Decision Records

This directory records decisions that shape the concept-browser
architecture. Each ADR follows the format proposed by Michael Nygard:

- **Status** — Proposed, Accepted, Superseded, Deprecated
- **Context** — what forces are in play, what problem we are solving
- **Decision** — what we chose and the one-line rationale
- **Consequences** — what we get, what we give up, what to watch for

ADRs are immutable history. When a decision is reversed, supersede it
with a new ADR and update the old one's status — do not edit the body.

## Index

| # | Title | Status |
| - | ----- | ------ |
| 0001 | [Graph-based RDF intermediate representation](0001-graph-based-rdf-ir.md) | Accepted |
| 0002 | [Escape `/` in Turtle prefixed local names](0002-turtle-pn-local-escaping.md) | Accepted |
| 0003 | [Cardinality-based JSON-LD emission](0003-cardinality-based-jsonld.md) | Accepted |
| 0004 | [Emit both `skos:` and `skosxl:` predicates](0004-dual-skos-skosxl.md) | Accepted |
| 0005 | [SHACL validation gate in the data pipeline](0005-shacl-validation-gate.md) | Accepted |
| 0006 | [Lazy-load the RDF serializer at view time](0006-lazy-load-serializer.md) | Accepted |
| 0007 | [PROV-O provenance decorator on emitted concept graphs](0007-provenance-decorator.md) | Accepted |
| 0008 | [Structured citation emission for concept sources](0008-structured-citation-emission.md) | Accepted |
