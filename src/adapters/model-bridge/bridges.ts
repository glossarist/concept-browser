/**
 * WeakMap bridges for fields not yet in glossarist-js's published d.ts.
 *
 * Each bridge attaches data the model doesn't expose via typed
 * properties. Getters retrieve it; attachBridges() populates it after
 * Concept.fromJSON creates the model instances.
 *
 * Remove each bridge when glossarist-js publishes native support
 * (tracked by PR glossarist/glossarist-js#31 and BRIDGES.md).
 */
import {
  Concept,
  LocalizedConcept,
  ConceptRef,
  Citation,
  DetailedDefinition,
} from 'glossarist';

// Annotations: LocalizedConcept.annotations
const extraAnnotations = new WeakMap<LocalizedConcept, DetailedDefinition[]>();

export function getAnnotations(lc: LocalizedConcept): DetailedDefinition[] {
  return extraAnnotations.get(lc) ?? [];
}

// Designation relationship targets: RelatedConcept.target (string)
const designationTargets = new WeakMap<object, string>();

export function getDesignationTarget(rc: { type?: string | null; content?: string | null; target?: string | null; ref?: any }): string | null {
  return designationTargets.get(rc) ?? rc.target ?? null;
}

// ConceptRef text: human-readable label alongside source/id
const refTexts = new WeakMap<ConceptRef, string>();

export function getRefText(ref: ConceptRef): string | null {
  return refTexts.get(ref) ?? null;
}

// RelatedConcept.sourceId: links a citation reference back to its source entry
const relatedSourceIds = new WeakMap<object, string>();

export function getRelatedSourceId(rc: object): string | null {
  return relatedSourceIds.get(rc) ?? null;
}

// RelatedConcept.citation: embedded citation data for cite-ref references
const relatedCitations = new WeakMap<object, Record<string, unknown>>();

export function getRelatedCitation(rc: object): Record<string, unknown> | null {
  return relatedCitations.get(rc) ?? null;
}

// Relationship types whose target is a designation string, not a concept ref.
export const DESIGNATION_REL_TYPES = new Set(['abbreviated_form_for', 'short_form_for']);

export function attachSourcedFromToSources(
  sources: readonly { sourced_from?: unknown }[],
  rawSources: unknown,
): void {
  if (!Array.isArray(rawSources)) return;
  for (let i = 0; i < sources.length && i < rawSources.length; i++) {
    const raw = rawSources[i] as Record<string, unknown> | undefined;
    if (raw?.sourced_from && Array.isArray(raw.sourced_from)) {
      (sources[i] as { sourced_from: unknown }).sourced_from = raw.sourced_from.map(
        (sf: unknown) => sf instanceof Citation ? sf : Citation.fromJSON(sf as Record<string, unknown>)
      );
    }
  }
}

/**
 * Attach bridged fields (ref text, sourceId, citation) to RelatedConcept instances
 * from the raw deserialized data. Called after Concept.fromJSON creates the model
 * instances, since RelatedConcept.fromJSON only reads type/content/ref.
 */
function attachRelatedBridges(
  modelRelated: Array<{ type?: string | null; content?: Record<string, string> | string | null; ref?: any; related?: any[] }>,
  rawRelated: unknown[],
): void {
  for (const rawRel of rawRelated) {
    if (!rawRel || typeof rawRel !== 'object') continue;
    const rel = rawRel as Record<string, unknown>;
    const relType = rel.type as string | undefined;
    const rc = relType ? modelRelated.find(r => r.type === relType) : undefined;
    if (!rc) continue;

    // Ref text
    if (rc.ref) {
      const rawRef = rel.ref as Record<string, unknown> | undefined;
      if (rawRef?.text && typeof rawRef.text === 'string') {
        refTexts.set(rc.ref, rawRef.text);
      }
    }

    // Designation target
    if (rel.target && typeof rel.target === 'string') {
      designationTargets.set(rc, rel.target);
    }

    // Source ID — links citation reference back to the ConceptSource entry
    if (rel.sourceId && typeof rel.sourceId === 'string') {
      relatedSourceIds.set(rc, rel.sourceId);
    }

    // Citation — embedded origin data for cite-ref references
    if (rel.citation && typeof rel.citation === 'object') {
      relatedCitations.set(rc, rel.citation as Record<string, unknown>);
    }
  }
}

export function attachBridges(concept: Concept, localizations: Record<string, unknown>): void {
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    const raw = localizations[lang];
    if (!lc || !raw || typeof raw !== 'object') continue;
    const rawObj = raw as Record<string, unknown>;

    // Attach sourced_from to localization-level sources
    attachSourcedFromToSources(lc.sources as unknown as { sourced_from?: unknown }[], rawObj.sources);

    // Annotations
    const annList = rawObj.annotations;
    if (Array.isArray(annList) && annList.length > 0) {
      extraAnnotations.set(lc, annList.map((a: Record<string, unknown>) =>
        DetailedDefinition.fromJSON({ content: (a.content as string) ?? '' }) as DetailedDefinition,
      ));
    }

    // Designation-level relationship targets, ref text, sourceId, citation
    const rawTerms = rawObj.terms;
    if (Array.isArray(rawTerms)) {
      for (let ti = 0; ti < rawTerms.length; ti++) {
        const rawTerm = rawTerms[ti];
        if (!rawTerm || typeof rawTerm !== 'object') continue;
        const rawT = rawTerm as Record<string, unknown>;
        const rawDesignation = rawT.designation as string | undefined;
        if (!rawDesignation) continue;
        const designation = lc.terms.find(d => d.designation === rawDesignation);
        if (!designation) continue;
        const rawRelated = rawT.related;
        if (!Array.isArray(rawRelated)) continue;
        attachRelatedBridges(designation.related, rawRelated);
        // Attach sourced_from to designation-level sources
        attachSourcedFromToSources(
          designation.sources as unknown as { sourced_from?: unknown }[],
          rawT.sources,
        );
      }
    }

    // Localization-level related concepts
    const rawRelated = rawObj.related;
    if (Array.isArray(rawRelated)) {
      attachRelatedBridges(lc.related, rawRelated);
    }
  }
}
