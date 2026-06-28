# ADR 0006: Lazy-load the RDF serializer at view time

- **Status**: Accepted
- **Date**: 2026-06-27

## Context

The RDF serializer (concept-emitter, turtle-writer, jsonld-writer,
sections-builder, n3 dependency) is a sizeable chunk of code
(~1500 LOC plus the `n3` parser). It is only needed when a user
opens a concept's **RDF tab** — the default tab is **Definition**.

If the serializer were eagerly imported from `ConceptDetail.vue`
into the main route bundle, every visitor's first-page payload
would include code most of them never use.

## Decision

`ConceptView.vue` is loaded via Vue Router's dynamic import at the
route declaration site:

```ts
// src/router/index.ts
{
  path: '/dataset/:registerId/concept/:conceptId',
  component: () => import('../views/ConceptView.vue'),
}
```

Vite follows the dynamic import boundary and emits `ConceptView` and
its transitive imports — including `ConceptRdfView`, the `concept-rdf/`
modules, and `n3` — into a dedicated `ConceptView-*.js` chunk. The
main `index-*.js` chunk contains no RDF code.

A bundle-layout test
(`src/__tests__/perf/bundle-layout.test.ts`) locks this in:

- the main `index-*` chunk must NOT match `/use-rdf-document/` or
  `/skosxl:literalForm/`;
- the `ConceptView-*` chunk MUST match `/skosxl:literalForm/`;
- no chunk may emit the legacy `xl:` prefix.

## Consequences

**Positive**

- First-page-load bundle stays small; the RDF serializer is fetched
  only when (and if) the user navigates to a concept and switches to
  the RDF tab.
- The bundle-layout test catches regressions: if a refactor pulls
  the serializer back into the main chunk, the test fails before
  merge.

**Negative**

- The first switch to the RDF tab incurs a chunk fetch (a few KB
  gzipped). Acceptable for a tab most users never open; mitigated
  by HTTP caching on subsequent navigations.
- The dynamic import boundary is implicit (declared at the route,
  not at the component). A future refactor that statically imports
  `ConceptRdfView` from the main entry would silently re-merge the
  chunks. The bundle-layout test is the guardrail.

**Alternatives considered**

- **Per-tab lazy loading** (`defineAsyncComponent(() => import('./ConceptRdfView.vue'))`
  inside ConceptDetail) — finer-grained but redundant given the
  route-level split already keeps the serializer out of the main
  chunk. Adds an extra fetch for a small marginal win. Revisit if
  ConceptView itself grows large.
- **Ship a separate `rdf-mode` build** — overkill; the route-level
  split achieves the goal with one dynamic import.
