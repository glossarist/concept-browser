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
  private crossRefIndex: Record<string, string[]> | null = null;

  constructor() {
    this.resolver = new ReferenceResolver();
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

    // Load source-refs index for citation resolution
    await this.loadSourceRefs();

    return adapters;
  }

  getAdapter(registerId: string): DatasetAdapter | undefined {
    return this.adapters.get(registerId);
  }

  getAdapters(): DatasetAdapter[] {
    return [...this.adapters.values()];
  }

  private registerDataset(registerId: string, manifest: Manifest): void {
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

    if (manifest.datasetUri) this.urnMap.set(manifest.datasetUri, registerId);
    for (const alias of manifest.uriAliases ?? []) {
      const base = alias.endsWith('*') ? alias.slice(0, -1) : alias;
      if (base.startsWith('urn:')) this.urnMap.set(base, registerId);
    }

    for (const adapter of this.adapters.values()) {
      adapter.setUrnMap(this.urnMap);
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
    if (!ref?.source || !ref?.id) return null;
    const uri = `${ref.source}/${ref.id}`;
    const resolution = this.resolve(uri, sourceDatasetId);
    if (resolution.type === 'internal') {
      return { registerId: resolution.registerId, conceptId: resolution.conceptId.replace(/^\//, '') };
    }
    if (ref.source.startsWith('urn:')) {
      const directUri = ref.source + ref.id;
      const directRes = this.resolve(directUri, sourceDatasetId);
      if (directRes.type === 'internal') {
        return { registerId: directRes.registerId, conceptId: directRes.conceptId.replace(/^\//, '') };
      }
    }
    return null;
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

  async loadSourceRefs(): Promise<void> {
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}data/source-refs.json`);
      if (!resp.ok) return;
      const refs: Record<string, string> = await resp.json();
      for (const [source, datasetId] of Object.entries(refs)) {
        const adapter = this.adapters.get(datasetId);
        if (!adapter?.manifest) continue;
        this.resolver.registerSourceRef(source, datasetId, adapter.manifest.datasetUri);
      }
    } catch {
      // source-refs.json is optional
    }
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
