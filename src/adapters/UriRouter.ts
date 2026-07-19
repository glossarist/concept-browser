import type { Manifest } from './types';
import { ConceptIdentity } from './concept-identity';

// ── URI pattern matching ────────────────────────────────────────────────────

function matchUriPattern(uri: string, pattern: string): boolean {
  if (!pattern.endsWith('*')) return uri === pattern;
  return uri.startsWith(pattern.slice(0, -1));
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

// ── Static parse regex ──────────────────────────────────────────────────────

const URI_REGISTER_RE = /\/([^/]+)\/concept\/([^/]+)$/;

// ── UriRouter ───────────────────────────────────────────────────────────────

/**
 * Single source of truth for URI routing.
 *
 * Maps URIs to {registerId, conceptId} pairs using dataset-registered URI
 * patterns. Supports wildcard patterns, URN prefix mapping, and URI construction.
 *
 * ReferenceResolver delegates URI matching here and adds its own concerns
 * (routing table, source refs, citation classification) on top.
 */
export class UriRouter {
  /** registerId → { baseUrl, uriBase, uriPatterns } */
  private registerMap = new Map<string, { baseUrl: string; uriBase: string; uriPatterns: string[] }>();

  /** URN prefix → registerId (extracted from uriPatterns at registration time) */
  private urnMap = new Map<string, string>();

  /**
   * Register a dataset's URI patterns for routing.
   * URN-prefixed patterns are also indexed for fast URN → registerId lookup.
   */
  registerDataset(registerId: string, baseUrl: string, uriBase: string, uriPatterns: string[]): void {
    this.registerMap.set(registerId, { baseUrl, uriBase, uriPatterns });

    for (const pattern of uriPatterns) {
      const base = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
      if (base.startsWith('urn:')) {
        // Store without trailing colon so prefix matching works naturally
        const clean = base.endsWith(':') ? base.slice(0, -1) : base;
        this.urnMap.set(clean, registerId);
      }
    }
  }

  /**
   * Resolve a URI to {registerId, conceptId} using registered patterns.
   * Returns null if no registered dataset matches.
   */
  resolveUri(uri: string): { registerId: string; conceptId: string } | null {
    for (const [registerId, info] of this.registerMap) {
      for (const pattern of info.uriPatterns) {
        if (matchUriPattern(uri, pattern)) {
          const conceptId = extractConceptId(uri, pattern);
          if (conceptId) return { registerId, conceptId };
        }
      }
    }
    return null;
  }

  /** Resolve a URN prefix to a registerId. Matches by longest prefix. Returns null if unknown. */
  resolveUrn(urn: string): string | null {
    // Try exact match first, then progressively shorter prefixes
    for (let len = urn.length; len > 0; len--) {
      const prefix = urn.slice(0, len);
      const match = this.urnMap.get(prefix);
      if (match) return match;
    }
    return null;
  }

  /** Get the uriBase for a register. Returns empty string if unknown. */
  getUriBase(registerId: string): string {
    return this.registerMap.get(registerId)?.uriBase ?? '';
  }

  /** Extract registerId and conceptId from any glossarist URI (no registration needed). */
  static parseUri(uri: string): { registerId: string; conceptId: string } | null {
    const m = uri.match(URI_REGISTER_RE);
    return m ? { registerId: m[1], conceptId: m[2] } : null;
  }

  /** Construct a canonical concept URI from components. */
  static buildConceptUri(uriBase: string, registerId: string, conceptId: string): string {
    return `${uriBase}/${registerId}/concept/${conceptId}`;
  }

  /** Construct a canonical URI for a concept. */
  buildUri(registerId: string, conceptId: string): string {
    const info = this.registerMap.get(registerId);
    const uriBase = info?.uriBase ?? '';
    return new ConceptIdentity(conceptId, registerId, uriBase).uri;
  }

  getRegisteredIds(): string[] {
    return [...this.registerMap.keys()];
  }
}
