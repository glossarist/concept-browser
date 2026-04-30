# Glossarist Canonical Concept Format

This document defines the **canonical YAML format** for Glossarist concept datasets. All datasets consumed by the Vocabulary Browser must conform to this format. Format variants are harmonized upstream — the browser pipeline handles only this canonical form.

## Canonical Concept YAML

Each concept is stored as a YAML file (e.g., `concept-102-01-01.yaml`) with this structure:

```yaml
termid: "102-01-01"              # string, unique within dataset
term: equality                   # convenience field: preferred English term
eng:                             # language block (ISO 639-2 code)
  terms:                         # REQUIRED, at least 1
    - type: expression           # expression | symbol | abbreviation
      designation: equality
      normative_status: preferred # preferred | deprecated | admitted
      gender: f                  # optional
      plurality: singular        # optional
      usage_info: Mathematik     # optional
  definition:                    # ALWAYS array of {content: "..."} objects
    - content: "relation between two entities..."
  notes:                         # optional, array of strings
    - "Note 1 content"
  examples:                      # optional, array of strings
    - "Example 1"
  language_code: eng
  entry_status: valid            # valid | superseded | withdrawn | draft
  sources:                       # ALWAYS array
    - type: authoritative        # authoritative | lineage
      origin:
        ref: ISO 1087-1:2000
        clause: "3.4.16"
        link: https://www.iso.org/standard/20057.html
  dates:                         # ALWAYS array of {type, date}
    - type: accepted
      date: "2008-08-01T00:00:00+00:00"
  review_date: "2024-01-01"
  review_decision_date: "2024-01-01"
  review_decision_event: published
  references:                    # structured cross-references (extracted from inline)
    - id: "https://glossarist.org/iev/concept/102-01-02"
      term: inequality
fra:                             # additional language blocks
  # ...same structure...
```

## Field Reference

### Root-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `termid` | string | yes | Unique concept identifier within the dataset |
| `term` | string | no | Preferred English term (convenience field) |
| `{lang}` | object | yes (≥1) | Language block keyed by ISO 639-2 code (eng, fra, deu, etc.) |

### Language block fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `terms` | array | yes | Designations (≥1 term required) |
| `definition` | array | no | Always `[{content: "..."}]` — bare strings not allowed |
| `notes` | array of strings | no | Explanatory notes |
| `examples` | array of strings | no | Usage examples |
| `language_code` | string | no | ISO 639-2 language code |
| `entry_status` | string | no | One of: `valid`, `superseded`, `withdrawn`, `draft` |
| `sources` | array | no | Always an array — singular forms not allowed |
| `dates` | array | no | Always `[{type, date}]` — scalar date fields not allowed |
| `review_date` | string | no | ISO 8601 date |
| `review_decision_date` | string | no | ISO 8601 date |
| `review_decision_event` | string | no | Review outcome description |
| `review_status` | string | no | Review status |
| `review_decision` | string | no | Review decision |
| `review_decision_notes` | string | no | Detailed change description |
| `release` | string | no | Release identifier |
| `lineage_source_similarity` | number | no | Lineage source similarity score |
| `references` | array | no | Structured cross-references |

### Term object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | `expression`, `symbol`, or `abbreviation` |
| `designation` | string | yes | The term text |
| `normative_status` | string | yes | `preferred`, `deprecated`, or `admitted` |
| `gender` | string | no | Grammatical gender (m/f/n) |
| `plurality` | string | no | `singular` or `plural` |
| `usage_info` | string | no | Disambiguation context |
| `international` | boolean | no | Whether the term is international |

### Source object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | no | `authoritative` or `lineage` |
| `origin.ref` | string | no | Source reference (standard name) |
| `origin.clause` | string | no | Specific clause |
| `origin.link` | string | no | URL to source document |

### Cross-reference object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Target concept URI (`https://glossarist.org/{register}/concept/{id}`) |
| `term` | string | no | Human-readable term for the reference |

## Harmonization Rules

Source datasets that don't conform to canonical format must be harmonized. The following transformations apply:

| Variant | Source format | Canonical format |
|---------|--------------|------------------|
| Definition | bare string `"text"` | `[{content: "text"}]` |
| Definition | `[{content: "text"}]` | unchanged |
| Sources | `authoritative_source: {link: "..."}` | `sources: [{type: authoritative, origin: {link: "..."}}]` |
| Sources | `sources: [{type, origin}]` | unchanged |
| Sources | absent | absent (kept as-is) |
| Dates | `date_accepted: "..."` scalar | `dates: [{type: accepted, date: "..."}]` |
| Dates | `dates: [{type, date}]` | unchanged |
| Entry status | `"Standard"` | `"valid"` |
| Entry status | absent | add `entry_status: valid` |
| Terms | `abbrev: true` | `type: abbreviation`, remove `abbrev` |
| Inline refs | `{{term, IEV:xxx}}` in text | `references: [{id: "...", term: "..."}]` |
| Inline refs | `{urn:iso:std:iso:NNNN:x.x,term}` | `references: [{id: "...", term: "..."}]` |
| `_revisions` | present | **stripped** |
| `termid` | number | string (cast) |

## Validation Rules

A conforming dataset must pass these checks:

1. Each concept file has `termid` (string)
2. Each concept has ≥1 language block with ≥1 term
3. No duplicate `termid` values within a dataset
4. `definition` is either absent or an array of `{content: "..."}` objects
5. `sources` is either absent or an array (no `authoritative_source` singular)
6. `dates` is either absent or an array of `{type, date}` objects
7. `entry_status` values are from: `valid`, `superseded`, `withdrawn`, `draft`
8. Cross-reference `id` values are valid concept URIs
9. No `_revisions` blocks (stripped during harmonization)
