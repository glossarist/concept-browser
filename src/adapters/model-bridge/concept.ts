/**
 * Top-level Concept loading: JSON-LD detection, Concept.fromJSON
 * orchestration, summary projection, URI construction.
 *
 * This module is the orchestration layer — mappers, bridges, and
 * partitive mapping live in their respective sibling modules.
 */
import { Concept } from 'glossarist';
import type { ConceptSummary } from '../types';
import { ConceptIdentity } from '../concept-identity';
import { GL } from '../wire-keys';
import { isJsonLd, mapLocalizedFromJsonLd, mapRelatedFromJsonLd } from './mappers';
import { mapHyperedgeFromJsonLd } from './hyperedge';
import { normalizeEntityRefs } from './entity-refs';
import { attachBridges, attachSourcedFromToSources } from './bridges';
import type { JsonLdConcept } from './jsonld-types';

function conceptFromJsonLd(doc: JsonLdConcept): Concept {
  const id = String(doc[GL.IDENTIFIER] ?? doc['@id']?.split('/').pop() ?? '');
  const localizations: Record<string, unknown> = {};

  const rawLc = doc[GL.LOCALIZED_CONCEPT] ?? {};
  for (const [lang, lc] of Object.entries(rawLc)) {
    if (lc && typeof lc === 'object') {
      localizations[lang] = mapLocalizedFromJsonLd(lc);
    }
  }

  const related = (doc[GL.RELATED] ?? []).map(mapRelatedFromJsonLd);

  // Unified hyperedge mapping: both partitive and generic relations
  // share the same JSON-LD wire shape. glossarist-js dispatches by
  // wire key (`partitive_relations` / `generic_relations`).
  const partitiveRelations = (doc[GL.PARTITIVE_RELATIONS] ?? [])
    .map((r: any) => mapHyperedgeFromJsonLd(r, 'gl:hasPartitive'))
    .filter((r): r is Record<string, unknown> => r !== null);

  const genericRelations = (doc[GL.GENERIC_RELATIONS] ?? [])
    .map((r: any) => mapHyperedgeFromJsonLd(r, 'gl:hasGeneric'))
    .filter((r): r is Record<string, unknown> => r !== null);

  const tagsArr = doc[GL.TAGS];
  const tags = Array.isArray(tagsArr) ? [...tagsArr] : [];

  const concept = Concept.fromJSON({
    id,
    term: doc[GL.TERM] ?? null,
    uri: doc['@id'] ?? null,
    localizations,
    related,
    partitive_relations: partitiveRelations,
    generic_relations: genericRelations,
    tags,
    figures: normalizeEntityRefs(doc[GL.FIGURE_REF]),
    tables: normalizeEntityRefs(doc[GL.TABLE_REF]),
    formulas: normalizeEntityRefs(doc[GL.FORMULA_REF]),
    status: null,
  });

  attachBridges(concept, localizations);
  return concept;
}

export function conceptFromJson(doc: Record<string, unknown>): Concept {
  if (isJsonLd(doc)) {
    return conceptFromJsonLd(doc as JsonLdConcept);
  }
  const concept = Concept.fromJSON(doc);
  const locs = (doc as Record<string, unknown>).localizations as Record<string, unknown> | undefined;
  if (locs) attachBridges(concept, locs);
  attachSourcedFromToSources(
    concept.sources as unknown as { sourced_from?: unknown }[],
    (doc as Record<string, unknown>).sources,
  );
  return concept;
}

export function conceptToSummary(concept: Concept): ConceptSummary {
  const designations: Record<string, string> = {};
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    if (lc?.primaryDesignation) {
      designations[lang] = lc.primaryDesignation;
    }
  }
  return {
    id: concept.id,
    designations,
    eng: designations.eng || Object.values(designations)[0] || '',
    status: concept.status ?? 'valid',
  };
}

export function conceptUri(concept: Concept, registerId: string, uriBase: string): string {
  if (concept.uri) return concept.uri;
  return new ConceptIdentity(concept.id, registerId, uriBase).uri;
}
