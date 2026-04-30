# Status: DONE

# 01 — Canonical Concept Format Specification

## Context

All glossarist datasets currently use slightly different YAML formats (IEV bare strings, Geolexica arrays, osgeo `authoritative_source`). The browser must not handle format variants — all datasets must conform to ONE canonical format before the browser sees them.

## Task

Create `docs/dataset-schema.md` defining the canonical concept YAML format and the harmonization rules.

### Canonical concept YAML

```yaml
termid: "102-01-01"              # string, unique within dataset
term: equality                   # convenience: preferred English term
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
  sources:                       # ALWAYS array (normalize singular forms)
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
```

### Harmonization rules

| Variant | Source format | Harmonized to |
|---------|--------------|---------------|
| Definition | bare string `"text"` | `[{content: "text"}]` |
| Definition | `[{content: "text"}]` | unchanged |
| Sources | `authoritative_source: {link: "..."}` | `sources: [{type: authoritative, origin: {link: "..."}}]` |
| Sources | `sources: [{type, origin}]` | unchanged |
| Sources | absent (IEV) | absent (kept absent) |
| Dates | `date_accepted: "..."` scalar | `dates: [{type: accepted, date: "..."}]` |
| Dates | `dates: [{type, date}]` array | unchanged |
| Entry status | `"Standard"` | `"valid"` |
| Notes | bare strings | bare strings (kept) |
| Terms | `abbrev: true` (osgeo) | `type: abbreviation` |
| `_revisions` | present (isotc211) | **stripped** |

## Files

- Create: `docs/dataset-schema.md`

## Verification

- Document exists, covers all fields, lists all harmonization rules
- Cross-referenced by GCR spec and adding-a-dataset doc
