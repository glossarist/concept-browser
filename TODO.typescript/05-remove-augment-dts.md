# 05 — [BLOCKED] Remove glossarist-augment.d.ts

**Priority:** P1
**Status:** BLOCKED on TODO 04
**Estimated effort:** small

## Context

`src/adapters/non-verbal/glossarist-augment.d.ts` (339 lines) patches 20 classes/interfaces that glossarist@0.4.34's stale `d.ts` doesn't declare. The upstream TS migration ships native types for all of them.

## Scope

- Delete `src/adapters/non-verbal/glossarist-augment.d.ts`
- Verify all imports in `src/` that previously relied on the augment resolve via the upstream types
- Remove any `as any` casts that existed only to work around the augment's limitations
- Check the `Concept` interface merge (`relations: AbstractHyperedge[]`) — upstream now declares this natively

## Classes/interfaces the augment provides (to verify upstream has)

RegistrableModel, FigureImage, NonVerbalEntity, SharedNonVerbalEntity, Figure, Table, Formula, NonVerbalReference, NonVerbRep, FigureReference, TableReference, FormulaReference, BibliographyEntry, BibliographyData, HyperedgeMember, PartitiveMember, GenericMember, AbstractHyperedge, PartitiveHyperedge, GenericHyperedge, plus COMPLETENESS, PARTITIVE_PRESENCE, PARTITIVE_COUNT, MULTIPLICITY constants.

## Acceptance criteria

- [ ] File deleted
- [ ] `npx vue-tsc --noEmit` passes without the augment
- [ ] No new `as any` casts introduced
- [ ] `npm test` passes
