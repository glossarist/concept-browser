# 10 — concept-browser: delete src/components/concept-rdf/ (TODO 36)

## Problem

After TODO 09 migrates `use-rdf-document.ts` to glossarist-js, the
entire `src/components/concept-rdf/` directory (~2300 LOC) becomes
dead code. Every file duplicates functionality now provided by
glossarist-js.

## Prerequisites

- TODO 06: namespaces/CURIE/bnode in glossarist-js ✓ (after merge)
- TODO 07: sections builder in glossarist-js
- TODO 08: provenance emitter in glossarist-js
- TODO 09: use-rdf-document.ts migrated
- No remaining imports of `../concept-rdf/*` (grep-verified)

## Files to delete (~2286 LOC)

| File | LOC | Replacement |
|------|-----|-------------|
| concept-emitter.ts | 443 | glossarist/rdf `conceptToQuads` |
| dataset-emitter.ts | 95 | glossarist/rdf `datasetToQuads` |
| group-emitter.ts | 68 | glossarist/rdf `groupToQuads` |
| bibliography-emitter.ts | 82 | glossarist/rdf `bibliographyToQuads` |
| agents-emitter.ts | 81 | glossarist/rdf `agentsToQuads` |
| version-emitter.ts | 64 | glossarist/rdf `versionToQuads` |
| image-variant-emitter.ts | 45 | glossarist/rdf `imageVariantToQuads` |
| vocabulary-emitter.ts | 62 | glossarist/rdf `vocabularyToQuads` |
| table-formula-emitter.ts | 100 | (none — emit at build time only) |
| build-activity-emitter.ts | 89 | glossarist/rdf `buildActivityToQuads` |
| turtle-writer.ts | 116 | glossarist/rdf `writeTurtleSync` |
| jsonld-writer.ts | 82 | glossarist/rdf `writeJsonLd` |
| rdf-graph.ts | 211 | (none — Quad[] is the IR now) |
| predicates.ts | 261 | glossarist/rdf `predicates` constants |
| sections-builder.ts | 62 | glossarist/rdf `quadSectionsToClassInstances` |
| provenance.ts | 80 | glossarist/rdf `provenanceToQuads` |
| use-rdf-document.ts | 72 | rewritten in TODO 09 |

## Files to KEEP (Vue UI components — not RDF)

- RdfSourcePanel.vue (72 lines)
- RdfInstanceHeader.vue (47 lines)
- RdfInstanceSection.vue (54 lines)
- RdfPrefixLegend.vue (27 lines)
- rdf-prefixes.ts (73 lines) — supplemental prefix metadata for UI

These move up to `src/components/` directly. The directory
`src/components/concept-rdf/` is removed entirely.

## Test files to delete

All test files under `src/__tests__/concept-rdf/` that exercise the
deleted emitters/writers. Tests that exercise glossarist-js
equivalents stay (they move to glossarist-js's own test suite).

## Deliverables

- [ ] Verify no remaining imports of `../concept-rdf/*`
- [ ] `git rm` the 17 dead files
- [ ] Move 4 Vue components + rdf-prefixes.ts up to `src/components/`
- [ ] Update import paths in `ConceptRdfView.vue`
- [ ] Verify no dangling imports (`grep -r 'concept-rdf' src/`)
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] SHACL conformance gate (Layer 4) still passes

## Risk

Large deletion. Risk is low IF all prerequisites are met — the code
is provably unused after TODO 09. The risk is in the prerequisites,
not the deletion itself. Verify by:
```bash
grep -r "from.*concept-rdf" src/ scripts/ cli/
```
Should return zero hits after TODO 09.
