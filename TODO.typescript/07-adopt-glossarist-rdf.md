# 07 — [BLOCKED] Adopt glossarist/rdf to replace custom IR

**Priority:** P2
**Status:** BLOCKED on TODO 04
**Estimated effort:** large

## Context

concept-browser has a custom RDF intermediate representation at `src/components/concept-rdf/` with emitters for concepts, datasets, groups, bibliography, build activity, agents, versions, image variants, tables, and formulas. glossarist-js now ships a complete quad-based RDF emitter at `glossarist/rdf` that covers the same ground.

## Scope

- Audit `src/components/concept-rdf/` against `glossarist/rdf` emitter coverage
- Map each custom emitter to its upstream equivalent:
  - `ConceptEmitter` → `conceptToQuads` + `localizedConceptToQuads`
  - `VocabularyEmitter` → `vocabularySchemeToQuads` + `vocabularyToQuads`
  - `DatasetEmitter` → `datasetToQuads`
  - `GroupEmitter` → `groupToQuads`
  - `BibliographyEmitter` → `bibliographyToQuads`
  - `BuildActivityEmitter` → `buildActivityToQuads`
  - `AgentsEmitter` → `agentsToQuads`
  - `VersionEmitter` → `versionToQuads`
  - `ImageVariantEmitter` → `imageVariantToQuads`
  - `TableFormulaEmitter` → (check upstream coverage)
- Replace custom IR with upstream calls
- Replace custom Turtle/JSON-LD writers with `writeTurtle` / `writeJsonld`

## Notes

- The upstream RDF layer uses `node:crypto` (lazily guarded) — browser-safe for the SPA bundle as long as the SPA doesn't import the RDF paths.
- Keep the custom IR if upstream is missing features (e.g., table/formula emitters). Don't force-fit.

## Acceptance criteria

- [ ] Coverage audit complete — every custom emitter has an upstream equivalent (or documented gap)
- [ ] Custom IR replaced with upstream calls where coverage is complete
- [ ] Generated Turtle output is semantically equivalent (diff against current output)
- [ ] No regression in SHACL validation (TODO 08)
