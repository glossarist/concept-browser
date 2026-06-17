# TODO: Figures — Consumer-Side Plan (concept-browser)

**IMPORTANT: glossarist-ruby is now the authoritative source for the figure
model.** The authoritative design lives at:
- `../glossarist-ruby/TODO.figures/README.md` — full design plan
- `../glossarist-ruby/lib/glossarist/figure.rb` — implemented Figure model
- `../glossarist-ruby/lib/glossarist/non_verbal_entity.rb` — base class
- `../concept-model/models/concepts/Figure.lutaml` — Lutaml model
- `../concept-model/schemas/v3/figure.yaml` — JSON Schema
- `../concept-model/ontologies/glossarist.ttl` — OWL ontology

## What changed from our original plan

The glossarist-ruby team expanded the scope beyond just Figures:

1. **All three types are dataset-level entities**: Figure, Table, Formula
   all inherit from `NonVerbalEntity` and are authored at
   `figures/`, `tables/`, `formulas/` directories.

2. **NonVerbRep coexists**: concept-owned inline NonVerbRep is still valid
   (enhanced with localized caption/description for accessibility).

3. **One inline mention syntax per type**: `{{fig:id}}`, `{{table:id}}`,
   `{{formula:id}}` — NOT the `<<fig:id>>` syntax we originally proposed.
   This is consistent with `{{cite:id}}` and `{{urn:...}}`.

4. **Structural references on ManagedConceptData**: `figures: []`,
   `tables: []`, `formulas: []` are on the concept-level data, not
   LocalizedConcept — entity identity is language-independent.

5. **No `layout` field**: layout (single/row/column/grid) is presentation,
   not model. Subfigures express the semantic structure; the browser
   derives layout.

## What concept-browser needs to do

The concept-browser is a CONSUMER of the glossarist model. Its tasks:

1. **Parse the glossarist-ruby output**: Figure/Table/Formula entities
   in JSON-LD format from `glossarist export`
2. **Render figures**: `<picture>` with srcset from FigureImage variants,
   localized caption/alt/description
3. **Resolve inline mentions**: `{{fig:id}}` → link to figure anchor
4. **Accessibility**: aria-describedby for long_desc, alt text for images
5. **Localization**: render caption/alt in the current language with
   fallback to English

The consumer-side tasks in this directory (03–13) remain relevant for
the concept-browser's rendering pipeline. The data model tasks (01, 02)
are superseded by the authoritative glossarist-ruby implementation.
