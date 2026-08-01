# 15 — Centralize all glossarist-js type imports

**Priority:** P4
**Status:** pending (after TODO 06)
**Estimated effort:** small

## Context

concept-browser imports glossarist types from multiple locations with inconsistent patterns:
- `import type { Concept, ConceptRef } from 'glossarist'`
- `import type { PartitiveMember } from 'glossarist/models'`
- `import { PartitiveHyperedge } from 'glossarist'`
- `import { GenericHyperedge } from 'glossarist/models'`

Some imports use the top-level entry; others deep-import from `glossarist/models`. The class is the same either way, but the inconsistency is a DRY violation.

## Scope

Create `src/adapters/glossarist-types.ts` — a single barrel that re-exports all the types/classes concept-browser uses from glossarist. All `src/` imports go through this barrel.

```typescript
// src/adapters/glossarist-types.ts
export type { Concept, LocalizedConcept, ConceptRef, ConceptSource, RelatedConcept } from 'glossarist';
export type { AbstractHyperedge, HyperedgeMember, PartitiveMember, GenericMember } from 'glossarist/models';
export { PartitiveHyperedge, GenericHyperedge } from 'glossarist/models';
export { COMPLETENESS, PARTITIVE_PRESENCE, PARTITIVE_COUNT } from 'glossarist/models';
// ... etc.
```

Then update all imports:
```typescript
// Before
import { Concept } from 'glossarist';
import { PartitiveHyperedge } from 'glossarist/models';

// After
import { Concept, PartitiveHyperedge } from '../adapters/glossarist-types';
```

## Rationale

- One place to update when glossarist's API changes
- Clear boundary between "what we import from glossarist" and "what we define ourselves"
- Easier to swap or vendor glossarist types if needed

## Acceptance criteria

- [ ] `src/adapters/glossarist-types.ts` created with all re-exports
- [ ] All `src/` imports that referenced `'glossarist'` or `'glossarist/models'` go through the barrel
- [ ] `vue-tsc --noEmit` passes
- [ ] `npm test` passes
