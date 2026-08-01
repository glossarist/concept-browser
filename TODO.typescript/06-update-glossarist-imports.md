# 06 — [BLOCKED] Update all glossarist imports for new subpath exports

**Priority:** P1
**Status:** BLOCKED on TODO 04
**Estimated effort:** medium

## Context

The TS-published glossarist has proper subpath exports. concept-browser currently imports everything from the top-level `'glossarist'` entry, which re-exports models but NOT rdf/transforms/validators. The augment also uses deep imports from `'glossarist/models'`.

## Key import changes needed

| Current import | New import | Notes |
|----------------|------------|-------|
| `from 'glossarist'` (Concept, ConceptRef, etc.) | `from 'glossarist'` | Top-level still re-exports models |
| `from 'glossarist/models'` (PartitiveHyperedge, GenericHyperedge) | `from 'glossarist/models'` | Same subpath, now with native types |
| (new) RDF emitters | `from 'glossarist/rdf'` | conceptToQuads, writeTurtle, etc. |
| (new) SHACL validation | `from 'glossarist/rdf/shacl'` | Node-only |
| (new) Validators | `from 'glossarist/validators'` | ConceptValidator, etc. |
| (new) Transforms | `from 'glossarist/transforms'` | ConceptToGlossTransform |

## Browser safety

The top-level `'glossarist'` entry must NOT import RDF/SHACL (which use `node:crypto`, `n3`, `rdf-validate-shacl`). Verify the upstream main entry is browser-safe before using in `src/` (client-side Vue app). If not browser-safe, use `'glossarist/models'` directly for client code and reserve `'glossarist/rdf'` for `scripts/` only.

## Acceptance criteria

- [ ] All imports resolve at runtime (Vite dev server starts)
- [ ] No browser bundle includes `node:crypto` or `n3` (check with `vite build` + bundle analysis)
- [ ] `vue-tsc --noEmit` passes
- [ ] `npm test` passes
