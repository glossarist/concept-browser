import type { Resolution } from './types';
import type { RoutingEntry } from '../config/types';

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

// ── URI pattern matching ───────────────────────────────────────────────────

interface DatasetEntry {
  id: string;
  uriPatterns: string[];
}

function extractConceptId(uri: string, pattern: string): string | null {
  if (!pattern.endsWith('*')) return null;
  const base = pattern.slice(0, -1);
  if (!uri.startsWith(base)) return null;
  const remainder = uri.slice(base.length);

  if (uri.startsWith('https://') || uri.startsWith('http://')) {
    const match = remainder.match(/^\/?concept\/([^/?#]+)/);
    return match ? match[1] : null;
  }
  if (uri.startsWith('urn:')) {
    return remainder || null;
  }
  return null;
}

function matchUriPattern(uri: string, pattern: string): boolean {
  if (!pattern.endsWith('*')) return uri === pattern;
  return uri.startsWith(pattern.slice(0, -1));
}

// ── ReferenceResolver ──────────────────────────────────────────────────────

export class ReferenceResolver {
  private datasets: DatasetEntry[] = [];
  private routing: RoutingEntry[] = [];
  private sourceRefs = new Map<string, { datasetId: string; uriPrefix: string }>();

  private static readonly URI_REGISTER_RE = /\/([^/]+)\/concept\/([^/]+)$/;

  static parseUri(uri: string): { registerId: string; conceptId: string } | null {
    const m = uri.match(ReferenceResolver.URI_REGISTER_RE);
    return m ? { registerId: m[1], conceptId: m[2] } : null;
  }

  registerDataset(id: string, uriPatterns: string[]): void {
    this.datasets.push({ id, uriPatterns });
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
    // Step 1: Check provided datasets
    for (const ds of this.datasets) {
      for (const pattern of ds.uriPatterns) {
        if (matchUriPattern(uri, pattern)) {
          const conceptId = extractConceptId(uri, pattern);
          if (conceptId) {
            return {
              type: 'internal',
              registerId: ds.id,
              conceptId,
              crossDataset: sourceDatasetId != null && sourceDatasetId !== ds.id,
            };
          }
        }
      }
    }

    // Step 2: Check routing table
    for (const entry of this.routing) {
      if (matchUriPattern(uri, entry.uri)) {
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
          const conceptId = this.extractConceptIdFromRouting(uri, entry.uri);
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

  private extractConceptIdFromRouting(uri: string, pattern: string): string | null {
    for (const ds of this.datasets) {
      for (const dsPattern of ds.uriPatterns) {
        if (matchUriPattern(uri, dsPattern)) {
          return extractConceptId(uri, dsPattern);
        }
      }
    }
    return extractConceptId(uri, pattern);
  }
}
