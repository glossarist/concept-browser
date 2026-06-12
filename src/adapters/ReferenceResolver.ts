import type { Resolution } from './types';
import type { RoutingEntry } from '../config/types';
import { UriRouter } from './UriRouter';

// ── Citation classification ────────────────────────────────────────────────

export type CitationClassification =
  | 'internal-citation'
  | 'self-contained-citation'
  | 'external-citation'
  | 'unresolved-citation';

export interface CiteResolution {
  classification: CitationClassification;
  resolved: { registerId: string; conceptId: string } | null;
}

/**
 * Lightweight citation shape used for classification.
 * Uses snake_case to match glossarist's Citation model conventions.
 */
interface CitationInput {
  ref?: { source?: string | null; id?: string | null; version?: string | null } | null;
  locality?: { type?: string | null; reference_from?: string | null; reference_to?: string | null; referenceFrom?: string | null; referenceTo?: string | null } | null;
  link?: string | null;
}

// ── ReferenceResolver ──────────────────────────────────────────────────────

/**
 * Resolves references (citations, source refs, URNs) to concepts.
 *
 * Delegates URI pattern matching to UriRouter (the single authority for URI routing).
 * Adds its own concerns on top: source-ref mapping, routing table, citation classification.
 */
export class ReferenceResolver {
  private routing: RoutingEntry[] = [];
  private sourceRefs = new Map<string, { datasetId: string; uriPrefix: string }>();
  private readonly uriRouter: UriRouter;

  constructor(uriRouter: UriRouter) {
    this.uriRouter = uriRouter;
  }

  registerSourceRef(sourceRef: string, datasetId: string, uriPrefix: string): void {
    this.sourceRefs.set(sourceRef, { datasetId, uriPrefix });
  }

  hasSourceRef(sourceRef: string): boolean {
    return this.sourceRefs.has(sourceRef);
  }

  loadRouting(entries: RoutingEntry[]): void {
    this.routing = entries;
  }

  resolveReference(uri: string, sourceDatasetId?: string): Resolution {
    // Step 1: Check registered datasets via UriRouter
    const resolved = this.uriRouter.resolveUri(uri);
    if (resolved) {
      return {
        type: 'internal',
        registerId: resolved.registerId,
        conceptId: resolved.conceptId,
        crossDataset: sourceDatasetId != null && sourceDatasetId !== resolved.registerId,
      };
    }

    // Step 2: Check routing table
    for (const entry of this.routing) {
      if (this.matchesRoutingPattern(uri, entry.uri)) {
        if (entry.type === 'site') {
          return {
            type: 'site',
            baseUrl: entry.baseUrl!,
            conceptUri: uri,
            label: entry.label,
          };
        }
        if (entry.type === 'url') {
          const template = entry.url!;
          const conceptId = this.extractConceptIdFromRouting(uri);
          const url = template.includes('{conceptId}') && conceptId
            ? template.replace('{conceptId}', conceptId)
            : template;
          return { type: 'url', url, label: entry.label };
        }
      }
    }

    return { type: 'unresolved', uri };
  }

  resolveCitation(source: string, referenceFrom: string, sourceDatasetId?: string): Resolution | null {
    const entry = this.sourceRefs.get(source);
    if (!entry) {
      // URN-based source strings resolve directly via dataset URI patterns
      if (!source.startsWith('urn:')) return null;
      return this.tryResolveCitationUri(source, referenceFrom, sourceDatasetId);
    }
    return this.tryResolveCitationUri(entry.uriPrefix, referenceFrom, sourceDatasetId);
  }

  private tryResolveCitationUri(uriPrefix: string, referenceFrom: string, sourceDatasetId?: string): Resolution | null {
    const uri = `${uriPrefix}/${referenceFrom}`;
    const result = this.resolveReference(uri, sourceDatasetId);
    if (result.type === 'internal') {
      return { ...result, conceptId: result.conceptId.replace(/^\//, '') };
    }
    const directUri = uriPrefix + referenceFrom;
    const directResult = this.resolveReference(directUri, sourceDatasetId);
    if (directResult.type === 'internal') {
      return { ...directResult, conceptId: directResult.conceptId.replace(/^\//, '') };
    }
    return null;
  }

  /**
   * Classify a citation and resolve it to a concept if possible.
   * Single source of truth for citation resolution — both classification
   * and navigation target come from this one method.
   */
  resolveCite(citation: CitationInput | null | undefined, sourceDatasetId?: string): CiteResolution {
    if (!citation?.ref?.source) {
      return { classification: 'unresolved-citation', resolved: null };
    }

    const referenceFrom = citation.locality?.reference_from ?? citation.locality?.referenceFrom ?? '';
    const resolution = this.resolveCitation(citation.ref.source, referenceFrom, sourceDatasetId);
    if (resolution?.type === 'internal') {
      return {
        classification: 'internal-citation',
        resolved: { registerId: resolution.registerId, conceptId: resolution.conceptId },
      };
    }

    if (citation.link) {
      return { classification: 'self-contained-citation', resolved: null };
    }

    return { classification: 'external-citation', resolved: null };
  }

  resolveRelatedRef(ref: { source: string | null; id: string | null } | null, sourceDatasetId?: string): { registerId: string; conceptId: string } | null {
    if (!ref?.source || !ref?.id) return null;
    const uri = `${ref.source}/${ref.id}`;
    const resolution = this.resolveReference(uri, sourceDatasetId);
    if (resolution.type === 'internal') {
      return { registerId: resolution.registerId, conceptId: resolution.conceptId.replace(/^\//, '') };
    }
    if (ref.source.startsWith('urn:')) {
      const directUri = ref.source + ref.id;
      const directRes = this.resolveReference(directUri, sourceDatasetId);
      if (directRes.type === 'internal') {
        return { registerId: directRes.registerId, conceptId: directRes.conceptId.replace(/^\//, '') };
      }
    }
    return null;
  }

  // ── Routing table helpers ────────────────────────────────────────────────

  private matchesRoutingPattern(uri: string, pattern: string): boolean {
    if (!pattern.endsWith('*')) return uri === pattern;
    return uri.startsWith(pattern.slice(0, -1));
  }

  private extractConceptIdFromRouting(uri: string): string | null {
    const resolved = this.uriRouter.resolveUri(uri);
    if (resolved) return resolved.conceptId;
    // Fallback: extract from URI structure
    // HTTP: /concept/{id}
    const httpMatch = uri.match(/\/concept\/([^/?#]+)/);
    if (httpMatch) return httpMatch[1];
    // URN: last colon-separated segment
    if (uri.startsWith('urn:')) {
      const parts = uri.split(':');
      return parts.length > 0 ? parts[parts.length - 1] : null;
    }
    return null;
  }
}
