# 09 — concept-browser: migrate use-rdf-document.ts to glossarist-js (TODO 35)

## Problem

`src/components/concept-rdf/use-rdf-document.ts` (72 lines) wires
together concept-browser's own concept-emitter + turtle-writer +
jsonld-writer + sections-builder + provenance. Every one of those
has an equivalent in glossarist-js now (after TODOs 06, 07, 08).

The current composable builds an `RdfGraph` (concept-browser's
abstraction) and then has to convert it to Quad[] for any
glossarist-js consumer. That's a wasteful intermediate
representation.

## Prerequisites

- TODO 06: namespaces + CURIE + bnode ID in glossarist-js
- TODO 07: sections builder from Quad[] in glossarist-js
- TODO 08: provenance emitter in glossarist-js

## Design

Rewrite `use-rdf-document.ts` to consume glossarist-js directly:

```ts
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { Concept } from 'glossarist';
import {
  conceptToQuads,
  collectQuads,
  writeTurtleSync,
  writeJsonLd,
  quadSectionsToClassInstances,
  provenanceToQuads,
} from 'glossarist/rdf';
import type { ClassInstance, PropValue } from 'glossarist/rdf';

export type { ClassInstance, PropValue };

export interface RdfDocument {
  sections: ComputedRef<ClassInstance[]>;
  turtle: ComputedRef<string>;
  jsonld: ComputedRef<string>;
  typeChain: ComputedRef<string[]>;
}

const SERIALIZER_VERSION =
  typeof __CONCEPT_BROWSER_VERSION__ !== 'undefined'
    ? __CONCEPT_BROWSER_VERSION__
    : 'dev';

export function useRdfDocument(
  getConcept: () => Concept,
  getConceptUri: () => string,
): RdfDocument {
  const emission = computed(() => {
    const concept = getConcept();
    const uri = getConceptUri();
    const conceptQuads = collectQuads(
      conceptToQuads(concept, { registerId: '', uriBase: '' })
    );
    const provenanceQuads = provenanceToQuads({
      subjectUri: uri,
      serializer: 'concept-browser',
      serializerVersion: SERIALIZER_VERSION,
      generatedAt: new Date().toISOString(),
    });
    return [...conceptQuads, ...provenanceQuads];
  });

  const sections = computed(() =>
    quadSectionsToClassInstances(emission.value, { language: 'eng' })
  );
  const turtle = computed(() =>
    writeTurtleSync(emission.value, { prefixes: RDF_PREFIXES })
  );
  const jsonld = computed(() =>
    writeJsonLd(emission.value, { prefixes: RDF_PREFIXES })
  );

  const typeChain = computed(() => {
    // derive from rdf:type quads + ontology schema
    return ['owl:Thing', 'skos:Concept', 'gloss:Concept'];
  });

  return { sections, turtle, jsonld, typeChain };
}
```

No RdfGraph. No concept-browser emitters. The composable drops from
72 lines to ~30.

## Deliverables

- [ ] Rewrite use-rdf-document.ts
- [ ] Verify Vue components (RdfSourcePanel, RdfInstanceHeader,
      RdfInstanceSection, RdfPrefixLegend) still render correctly
- [ ] Update round-trip tests to use glossarist's conceptToQuads
- [ ] Verify all concept fixtures produce equivalent RDF
- [ ] Regenerate snapshots if format differs

## Tests

- All existing round-trip tests pass with the new emitter
- Snapshot tests may need regeneration (format differences)
- Visual verification of concept detail page in browser
- SHACL conformance test still passes (Layer 4 gate)

## Risk

High. This is the single point where RDF meets the Vue UI. Any
divergence in shape (different prop ordering, different label
resolution) breaks the UI silently. Mitigation:
- Golden-file diff of section output for all concept fixtures
- Run the dev server and click through 10+ concepts before merging
