import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import type { Concept } from 'glossarist';
import { getClass } from '../../adapters/ontology-schema';
import { ConceptIdentity } from '../../adapters/concept-identity';
import { emitConceptGraph } from './concept-emitter';
import { writeTurtle } from './turtle-writer';
import { writeJsonLd } from './jsonld-writer';
import { buildSections } from './sections-builder';
import type { ClassInstance, PropValue } from './sections-builder';
import { decorateWithProvenance, runtimeProvenance } from './provenance';

export type { ClassInstance, PropValue } from './sections-builder';

export interface RdfDocument {
  sections: ComputedRef<ClassInstance[]>;
  turtle: ComputedRef<string>;
  jsonld: ComputedRef<string>;
  typeChain: ComputedRef<string[]>;
}

export interface UseRdfDocumentOptions {
  readonly lazy?: boolean;
}

const SERIALIZER_VERSION =
  typeof __CONCEPT_BROWSER_VERSION__ !== 'undefined'
    ? __CONCEPT_BROWSER_VERSION__
    : 'dev';

export function useRdfDocument(
  getConcept: () => Concept,
  getConceptUri: () => string,
  _options: UseRdfDocumentOptions = {},
): RdfDocument {
  const identity = computed(() => {
    const concept = getConcept();
    const uri = getConceptUri();
    if (ConceptIdentity.isConceptUri(uri)) {
      const parsed = ConceptIdentity.fromUri(uri);
      if (parsed.localId === concept.id) return parsed;
    }
    return new ConceptIdentity(concept.id, '', '');
  });

  const safeUri = computed(() => {
    const uri = getConceptUri();
    return uri || identity.value.uri;
  });

  const emission = computed(() => {
    const result = emitConceptGraph(getConcept(), safeUri.value);
    decorateWithProvenance(
      result.graph,
      safeUri.value,
      runtimeProvenance(SERIALIZER_VERSION, safeUri.value),
    );
    return result;
  });

  const sections = computed(() => buildSections(emission.value.graph));
  const turtle = computed(() => writeTurtle(emission.value.graph));
  const jsonld = computed(() => writeJsonLd(emission.value.graph));

  const typeChain = computed(() => {
    const conceptCls = getClass('gloss:Concept');
    if (!conceptCls) return ['owl:Thing', 'skos:Concept', 'gloss:Concept'];
    return ['owl:Thing', ...conceptCls.ancestors, 'gloss:Concept'];
  });

  return { sections, turtle, jsonld, typeChain };
}
