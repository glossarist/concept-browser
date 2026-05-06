import type { Resolution } from './types';
import type { RoutingEntry } from '../config/types';

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

export class ReferenceResolver {
  private datasets: DatasetEntry[] = [];
  private routing: RoutingEntry[] = [];

  registerDataset(id: string, uriPatterns: string[]): void {
    this.datasets.push({ id, uriPatterns });
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
