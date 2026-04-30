import type { DatasetRegistry, Manifest } from './types';
import { DatasetAdapter } from './DatasetAdapter';
import { UriRouter } from './UriRouter';

export class AdapterFactory {
  private adapters = new Map<string, DatasetAdapter>();
  readonly router = new UriRouter();

  async discoverDatasets(datasetsUrl: string): Promise<DatasetAdapter[]> {
    const resp = await fetch(datasetsUrl);
    if (!resp.ok) throw new Error(`Failed to load dataset registry: ${resp.status}`);
    const registry = (await resp.json()) as DatasetRegistry[];

    const adapters: DatasetAdapter[] = [];
    for (const reg of registry) {
      const adapter = new DatasetAdapter(reg.id, `/data/${reg.id}`);
      this.adapters.set(reg.id, adapter);
      adapters.push(adapter);
    }

    // Load manifests eagerly (small JSON) so home page has titles, counts, etc.
    await Promise.all(adapters.map(a => a.loadManifest().catch(() => {})));

    return adapters;
  }

  getAdapter(registerId: string): DatasetAdapter | undefined {
    return this.adapters.get(registerId);
  }

  getAdapters(): DatasetAdapter[] {
    return [...this.adapters.values()];
  }

  async loadDataset(registerId: string): Promise<DatasetAdapter> {
    const adapter = this.adapters.get(registerId);
    if (!adapter) throw new Error(`Unknown dataset: ${registerId}`);

    const manifest = await adapter.loadManifest();
    await adapter.loadIndex();

    this.router.registerDataset(registerId, `/data/${registerId}`, manifest);
    return adapter;
  }

  resolveUri(uri: string): { adapter: DatasetAdapter; conceptId: string } | null {
    const resolved = this.router.resolveUri(uri);
    if (!resolved) return null;
    const adapter = this.adapters.get(resolved.registerId);
    if (!adapter) return null;
    return { adapter, conceptId: resolved.conceptId };
  }
}

let _instance: AdapterFactory | null = null;

export function getFactory(): AdapterFactory {
  if (!_instance) _instance = new AdapterFactory();
  return _instance;
}
