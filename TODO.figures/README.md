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
   `src/components/NonVerbalRepDisplay.vue` already exists for this case.

3. **One inline mention syntax per type**: `{{fig:id}}`, `{{table:id}}`,
   `{{formula:id}}` — NOT the `<<fig:id>>` syntax we originally proposed.
   This is consistent with `{{cite:id}}` and `{{urn:...}}` and routes
   through the existing `parseMention` dispatcher.

4. **Structural references on ManagedConceptData**: `figures: []`,
   `tables: []`, `formulas: []` are on the concept-level data, not
   LocalizedConcept — entity identity is language-independent.

5. **No `layout` field**: layout (single/row/column/grid) is presentation,
   not model. Subfigures express the semantic structure; the browser
   derives layout at render time.

## What concept-browser needs to do

The concept-browser is a CONSUMER of the glossarist model. Its tasks:

1. **Parse the glossarist-ruby output**: Figure/Table/Formula entities
   in JSON-LD format from `glossarist export`.
2. **Render figures**: `<picture>` with srcset from FigureImage variants,
   localized caption/alt/description.
3. **Render tables and formulas**: type-specific components for the
   sibling entities.
4. **Resolve inline mentions**: `{{fig:id}}`, `{{table:id}}`,
   `{{formula:id}}` → link to entity anchor.
5. **Accessibility**: `aria-describedby` for `description`, alt text for
   images, screen-reader announcements on navigation.
6. **Localization**: render caption/alt/description in the current
   language with fallback to English.

## File map (consumer-side tasks)

The data-model tasks (01, 02) are mirrors of the authoritative source —
they document what concept-browser needs to know about the model, not
what the model IS. The rendering/runtime tasks (03–13) are
concept-browser-specific.

| #  | File                              | Concern (consumer-side)                                |
| -- | --------------------------------- | ----------------------------------------------------- |
| 01 | `01-data-model.md`                | TS types mirroring authoritative model (Figure, Table, Formula, NonVerbalEntity, FigureImage) |
| 02 | `02-figure-references.md`         | `{{fig:id}}`, `{{table:id}}`, `{{formula:id}}` mentions + structural arrays on concept |
| 03 | `03-build-extraction.md`          | Read glossarist export → emit to `public/data/{ds}/`  |
| 04 | `04-asset-pipeline.md`            | Image byte copying, format validation, manifest       |
| 05 | `05-runtime-resolver.md`          | `NonVerbalEntityResolver` dispatching by type         |
| 06 | `06-content-renderer.md`          | Mention dispatcher integration for fig/table/formula  |
| 07 | `07-figure-component.md`          | `FigureDisplay.vue` with derived layout               |
| 07b| `07b-table-component.md`          | `TableDisplay.vue` (structured/markup content)        |
| 07c| `07c-formula-component.md`        | `FormulaDisplay.vue` (LaTeX/MathML/AsciiMath)         |
| 08 | `08-cross-references.md`          | Click → scroll → highlight for all three types        |
| 09 | `09-accessibility.md`             | a11y policy shared across all three display components |
| 10 | `10-localization.md`              | Locale fallback SSOT; image role semantics            |
| 11 | `11-round-trip-spec.md`           | JSON-LD → TS model preservation (consumer-side)       |
| 12 | `12-render-spec.md`               | Component DOM render spec for all three components    |
| 13 | `13-docs.md`                      | Consumer-side author + maintainer docs                |

## V3 authoritative sync (2026-06-18)

After the original 13 tasks were drafted, glossarist-ruby landed three
breaking changes that the consumer must absorb. The full audit and
coordinator live in [14-v3-authoritative-sync.md](14-v3-authoritative-sync.md).

| #  | File | Concern |
| -- | ---- | ------- |
| 14 | [14-v3-authoritative-sync.md](14-v3-authoritative-sync.md) | Master audit + coordinator for the V3 model sync |
| 15 | [15-bibliography-v3-shape.md](15-bibliography-v3-shape.md) | **Time-bomb fix.** Bibliography single-key wrap + `BibliographyAdapter` |
| 16 | [16-nonverbrep-reshape.md](16-nonverbrep-reshape.md) | `NonVerbalRepDisplay.vue` rewrite for `images[]`/`alt` shape |
| 17 | [17-figures-yaml-consumer.md](17-figures-yaml-consumer.md) | Verify `figures/{id}.yaml` consumption end-to-end |
| 18 | [18-images-yaml-drop.md](18-images-yaml-drop.md) | Documentation cleanup for `images.yaml` removal |
| 19 | [19-glossarist-js-v4-sync.md](19-glossarist-js-v4-sync.md) | Adopt glossarist-js v0.4.0 — eliminate parallel TS projection, use upstream models directly |

**Critical path: 15 must land before the next data refresh.**

## Sequence

Dependency order:

```
Foundation:  01 ─► 02 ─┬─► 03 ─► 04
                       │
                       └─► 11 (round-trip spec grows)

Runtime:      05 ─► 06 ─┬─► 07 ─┐
                        │       ├─► 08
                        ├─► 07b │
                        ├─► 07c │
                        │       │
                        └─► 12  │
                                │
Cross-cutting: 09, 10 ──────────┘

Docs:         13 (last — when the API has stabilized)
```

## V3 sync sequence

```
14 (audit + coordinator)
 │
 ├─► 15 (bibliography) ──► refresh data, validate
 │
 ├─► 16 (NonVerbRep) ──► waits for glossarist-js release
 │
 ├─► 17 (figures YAML) ──► verify only, no work expected
 │
 └─► 18 (images.yaml drop) ──► documentation only
```

## Critical architectural rules for the consumer side

1. **Never duplicate model logic.** The model is in glossarist-ruby. The
   consumer mirrors it; it does not redefine it.
2. **Never call `fetch()` from components.** All data access goes through
   resolvers. (Same rule as the rest of the codebase.)
3. **No shell commands in build scripts.** Pure Node + Buffer for asset
   handling, per the user's hard rule.
4. **One inline syntax per type.** `{{fig:id}}`, `{{table:id}}`,
   `{{formula:id}}` route through `parseMention`. No `<<fig:id>>`,
   no `image::`, no ad-hoc notation.
5. **Derive layout, don't store it.** The component looks at subfigure
   count and structure; it does not read a `layout` field.
6. **Identifier is a plain string.** Language-stable. Don't localize.
7. **Field name is `description`.** Not `longDesc`, not `long_desc`.
8. **Backward compatibility.** The existing `NonVerbalRepDisplay.vue`
   continues to handle concept-owned inline non-verbal representations.
   New entity-level components are additive.

## Open issue: vocabulary prefix

The concept-browser's existing JSON-LD corpus uses **`gl:`** prefix.
The glossarist-ruby team's design docs use **`gloss:`** prefix. This is
unresolved at the ontology level. See `AUDIT.figures.md` §"Open issue:
vocabulary prefix" for the full statement and the consumer's interim
position (continue using `gl:`).

## Out of scope for V1

- Cross-dataset entity references (`{{fig:urn:...}}`).
- Animated images (GIF/APNG/WebM).
- Build-time image optimization (zopflipng, oxipng, svgo).
- External image URLs (CDN-hosted).
- Per-figure licensing metadata beyond `sources[]`.
- Auto-translation of captions / alt.
- Image recognition / OCR for alt text generation.
