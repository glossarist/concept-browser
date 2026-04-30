import type { Manifest } from './types';

export class UriRouter {
  private registerMap = new Map<string, { baseUrl: string; manifest: Manifest | null; uriBase: string }>();

  registerDataset(registerId: string, baseUrl: string, manifest?: Manifest) {
    this.registerMap.set(registerId, {
      baseUrl,
      manifest: manifest ?? null,
      uriBase: manifest?.uriBase ?? 'https://glossarist.org',
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

  buildUri(registerId: string, conceptId: string): string {
    const info = this.registerMap.get(registerId);
    const uriBase = info?.uriBase ?? 'https://glossarist.org';
    return `${uriBase}/${registerId}/concept/${conceptId}`;
  }

  getRegisteredIds(): string[] {
    return [...this.registerMap.keys()];
  }
}
