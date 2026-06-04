import type { DatasetRegistry, Manifest, Resolution } from './types';
import type { RoutingEntry as ConfigRoutingEntry } from '../config/types';
import { DatasetAdapter } from './DatasetAdapter';
import { UriRouter } from './UriRouter';
import { ReferenceResolver } from './ReferenceResolver';

export class AdapterFactory {
  private adapters = new Map<string, DatasetAdapter>();
  private urnMap = new Map<string, string>();
  readonly router = new UriRouter();
  readonly resolver: ReferenceResolver;

  constructor() {
    this.resolver = new ReferenceResolver();
  }

  async discoverDatasets(datasetsUrl: string): Promise<DatasetAdapter[]> {
    const resp = await fetch(datasetsUrl);
    if (!resp.ok) throw new Error(`Failed to load dataset registry: ${resp.status}`);
    const registry = (await resp.json()) as DatasetRegistry[];

    const base = import.meta.env.BASE_URL;
    const adapters: DatasetAdapter[] = [];
    for (const reg of registry) {
      const adapter = new DatasetAdapter(reg.id, `${base}data/${reg.id}`);
      this.adapters.set(reg.id, adapter);
      adapters.push(adapter);
    }

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

    this.router.registerDataset(registerId, `${import.meta.env.BASE_URL}data/${registerId}`, manifest);

    const uriPatterns = [
      manifest.datasetUri,
      ...(manifest.uriAliases ?? []),
      manifest.uriBase ? `${manifest.uriBase}/${registerId}/*` : undefined,
    ].filter(Boolean) as string[];
    this.resolver.registerDataset(registerId, uriPatterns);

    if (manifest.ref) {
      this.resolver.registerSourceRef(manifest.ref, registerId, manifest.datasetUri);
    }
    for (const alias of manifest.refAliases ?? []) {
      this.resolver.registerSourceRef(alias, registerId, manifest.datasetUri);
    }

    // Build URN→datasetId map from manifest
    if (manifest.datasetUri) this.urnMap.set(manifest.datasetUri, registerId);
    for (const alias of manifest.uriAliases ?? []) {
      const base = alias.endsWith('*') ? alias.slice(0, -1) : alias;
      if (base.startsWith('urn:')) this.urnMap.set(base, registerId);
    }

    // Distribute the updated URN map to all loaded adapters
    for (const adapter of this.adapters.values()) {
      adapter.setUrnMap(this.urnMap);
    }

    return adapter;
  }

  loadRouting(entries: ConfigRoutingEntry[]): void {
    this.resolver.loadRouting(entries);
  }

  resolve(uri: string, sourceDatasetId?: string): Resolution {
    return this.resolver.resolveReference(uri, sourceDatasetId);
  }

  resolveCitation(source: string, referenceFrom: string, sourceDatasetId?: string): Resolution | null {
    return this.resolver.resolveCitation(source, referenceFrom, sourceDatasetId);
  }
}

let _instance: AdapterFactory | null = null;

export function getFactory(): AdapterFactory {
  if (!_instance) _instance = new AdapterFactory();
  return _instance;
}

export function resetFactory(): void {
  _instance = null;
}
