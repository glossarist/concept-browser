import type { DatasetRegistry, Manifest, Resolution } from './types';
import type { RoutingEntry as ConfigRoutingEntry } from '../config/types';
import { DatasetAdapter } from './DatasetAdapter';
import { ReferenceResolver } from './ReferenceResolver';
import { UriRouter } from './UriRouter';

export class AdapterFactory {
  private adapters = new Map<string, DatasetAdapter>();
  private crossRefIndex: Record<string, string[]> | null = null;
  readonly uriRouter: UriRouter;
  readonly resolver: ReferenceResolver;

  constructor() {
    this.uriRouter = new UriRouter();
    this.resolver = new ReferenceResolver(this.uriRouter);
  }

  async discoverDatasets(datasetsUrl: string): Promise<DatasetAdapter[]> {
    let registry: DatasetRegistry[];
    const inline = document.getElementById('datasets-json');
    if (inline?.textContent) {
      registry = JSON.parse(inline.textContent) as DatasetRegistry[];
    } else {
      const resp = await fetch(datasetsUrl);
      if (!resp.ok) throw new Error(`Failed to load dataset registry: ${resp.status}`);
      registry = await resp.json() as DatasetRegistry[];
    }

    const base = import.meta.env.BASE_URL;
    const adapters: DatasetAdapter[] = [];
    const needManifest: DatasetAdapter[] = [];

    for (const reg of registry) {
      const adapter = new DatasetAdapter(reg.id, `${base}data/${reg.id}`);
      this.adapters.set(reg.id, adapter);
      adapters.push(adapter);

      if (reg.summary) {
        adapter.setSummaryManifest(reg.summary, reg);
      } else {
        needManifest.push(adapter);
      }
    }

    if (needManifest.length > 0) {
      await Promise.all(needManifest.map(a => a.loadManifest().catch(() => {})));
    }

    for (const adapter of adapters) {
      if (adapter.manifest) {
        this.registerDataset(adapter.registerId, adapter.manifest);
      }
    }

    // Register bibliography from registry config (ref/refAliases → URN)
    // This is the single source of truth — no separate source-refs file needed.
    for (const reg of registry) {
      if (!reg.datasetUri) continue;
      if (reg.ref) {
        this.resolver.registerSourceRef(reg.ref, reg.id, reg.datasetUri);
      }
      for (const alias of reg.refAliases ?? []) {
        this.resolver.registerSourceRef(alias, reg.id, reg.datasetUri);
      }
    }

    return adapters;
  }

  getAdapter(registerId: string): DatasetAdapter | undefined {
    return this.adapters.get(registerId);
  }

  getAdapters(): DatasetAdapter[] {
    return [...this.adapters.values()];
  }

  private registerDataset(registerId: string, manifest: Manifest): void {
    const uriPatterns = [
      manifest.datasetUri,
      ...(manifest.uriAliases ?? []),
      manifest.uriBase ? `${manifest.uriBase}/${registerId}/*` : undefined,
    ].filter(Boolean) as string[];

    this.uriRouter.registerDataset(
      registerId,
      manifest.baseUrl,
      manifest.uriBase,
      uriPatterns,
    );

    // Propagate URN map to all adapters for ref-target resolution
    const urnMap = new Map<string, string>();
    for (const id of this.uriRouter.getRegisteredIds()) {
      const uriBase = this.uriRouter.getUriBase(id);
      if (!uriBase) continue;
      // Reconstruct URN map from uriRouter registrations
      for (const pattern of [manifest.datasetUri, ...(manifest.uriAliases ?? [])]) {
        if (!pattern) continue;
        const base = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
        if (base.startsWith('urn:')) urnMap.set(base, registerId);
      }
    }
    // Include URNs from all previously registered datasets
    for (const adapter of this.adapters.values()) {
      const m = adapter.manifest;
      if (!m) continue;
      for (const pattern of [m.datasetUri, ...(m.uriAliases ?? [])]) {
        if (!pattern) continue;
        const base = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
        if (base.startsWith('urn:')) urnMap.set(base, adapter.registerId);
      }
    }
    for (const adapter of this.adapters.values()) {
      adapter.setUrnMap(urnMap);
    }
  }

  async loadDataset(registerId: string): Promise<DatasetAdapter> {
    const adapter = this.adapters.get(registerId);
    if (!adapter) throw new Error(`Unknown dataset: ${registerId}`);

    const manifest = await adapter.loadManifest();
    await adapter.loadIndex();

    this.registerDataset(registerId, manifest);

    return adapter;
  }

  loadRouting(entries: ConfigRoutingEntry[]): void {
    this.resolver.loadRouting(entries);
  }

  resolve(uri: string, sourceDatasetId?: string): Resolution {
    return this.resolver.resolveReference(uri, sourceDatasetId);
  }

  resolveRelatedRef(ref: { source: string | null; id: string | null } | null, sourceDatasetId?: string): { registerId: string; conceptId: string } | null {
    return this.resolver.resolveRelatedRef(ref, sourceDatasetId);
  }

  resolveCitation(source: string, referenceFrom: string, sourceDatasetId?: string): Resolution | null {
    return this.resolver.resolveCitation(source, referenceFrom, sourceDatasetId);
  }

  async loadCrossRefIndex(): Promise<Record<string, string[]>> {
    if (this.crossRefIndex) return this.crossRefIndex;
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}data/cross-ref-index.json`);
      if (resp.ok) {
        this.crossRefIndex = await resp.json();
      }
    } catch {
      // Fall through to empty index
    }
    this.crossRefIndex = this.crossRefIndex || {};
    return this.crossRefIndex;
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
