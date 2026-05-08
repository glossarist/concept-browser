import type { Manifest } from './types';

const URI_REGISTER_RE = /\/([^/]+)\/concept\/([^/]+)$/;

export class UriRouter {
  private registerMap = new Map<string, { baseUrl: string; manifest: Manifest | null; uriBase: string }>();

  registerDataset(registerId: string, baseUrl: string, manifest?: Manifest) {
    this.registerMap.set(registerId, {
      baseUrl,
      manifest: manifest ?? null,
      uriBase: manifest?.uriBase ?? '',
    });
  }

  resolveUri(uri: string): { registerId: string; conceptId: string } | null {
    for (const [registerId, info] of this.registerMap) {
      const prefix = `${info.uriBase}/${registerId}/concept/`;
      if (uri.startsWith(prefix)) {
        return { registerId, conceptId: uri.slice(prefix.length) };
      }
    }
    return null;
  }

  /** Extract registerId and conceptId from any glossarist URI (no registration needed). */
  static parseUri(uri: string): { registerId: string; conceptId: string } | null {
    const m = uri.match(URI_REGISTER_RE);
    return m ? { registerId: m[1], conceptId: m[2] } : null;
  }

  buildUri(registerId: string, conceptId: string): string {
    const info = this.registerMap.get(registerId);
    const uriBase = info?.uriBase ?? '';
    return `${uriBase}/${registerId}/concept/${conceptId}`;
  }

  getRegisteredIds(): string[] {
    return [...this.registerMap.keys()];
  }
}
