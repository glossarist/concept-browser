import type {
  Manifest,
  ConceptIndex,
  ConceptSummary,
  ConceptEntry,
  ConceptDocument,
  SearchHit,
  GraphEdge,
} from './types';
import { UriRouter } from './UriRouter';

export class DatasetAdapter {
  private positionIndex = new Map<string, number>();
  readonly registerId: string;
  private baseUrl: string;
  manifest: Manifest | null = null;
  index: ConceptIndex | null = null;

  private conceptCache = new Map<string, ConceptDocument>();
  private summaryMap = new Map<string, ConceptSummary>();
  private loadedChunks = new Set<number>();
  private indexMeta: { conceptCount: number; chunkSize: number; chunks: { file: string; count: number }[] } | null = null;

  constructor(registerId: string, baseUrl: string) {
    this.registerId = registerId;
    this.baseUrl = baseUrl;
  }

  async loadManifest(): Promise<Manifest> {
    const resp = await fetch(`${this.baseUrl}/manifest.json`);
    if (!resp.ok) throw new Error(`Failed to load manifest for ${this.registerId}: ${resp.status}`);
    this.manifest = (await resp.json()) as Manifest;
    return this.manifest;
  }

  async loadIndex(): Promise<ConceptIndex> {
    const manifest = this.manifest;
    const isLarge = manifest && manifest.conceptCount > 1000;

    if (isLarge) {
      return this.loadIndexChunked();
    }

    const resp = await fetch(`${this.baseUrl}/index.json`);
    if (!resp.ok) throw new Error(`Failed to load index for ${this.registerId}: ${resp.status}`);
    this.index = (await resp.json()) as ConceptIndex;
    this.summaryMap.clear();
    this.positionIndex.clear();
    for (let i = 0; i < this.index.concepts.length; i++) {
      this.summaryMap.set(this.index.concepts[i].id, this.index.concepts[i]);
      this.positionIndex.set(this.index.concepts[i].id, i);
    }
    return this.index;
  }

  private async loadIndexChunked(): Promise<ConceptIndex> {
    const metaResp = await fetch(`${this.baseUrl}/index-meta.json`);
    let meta: { registerId: string; schemaVersion: string; conceptCount: number; chunkSize: number; chunks: { file: string; count: number }[] };
    if (metaResp.ok) {
      meta = await metaResp.json();
    } else {
      const resp = await fetch(`${this.baseUrl}/index.json`);
      if (!resp.ok) throw new Error(`Failed to load index for ${this.registerId}`);
      this.index = (await resp.json()) as ConceptIndex;
      this.summaryMap.clear();
      this.positionIndex.clear();
      for (let i = 0; i < this.index.concepts.length; i++) {
        this.summaryMap.set(this.index.concepts[i].id, this.index.concepts[i]);
        this.positionIndex.set(this.index.concepts[i].id, i);
      }
      return this.index;
    }

    this.indexMeta = {
      conceptCount: meta.conceptCount,
      chunkSize: meta.chunkSize,
      chunks: meta.chunks,
    };

    // Pre-allocate array so positions match concept order — undefined = not loaded yet
    this.index = {
      registerId: meta.registerId,
      schemaVersion: meta.schemaVersion,
      conceptCount: meta.conceptCount,
      chunkSize: meta.chunkSize,
      chunks: meta.chunks,
      concepts: new Array(meta.conceptCount),
    };

    await this.loadChunkAsSummaries(0);

    return this.index;
  }

  async loadChunk(chunkIndex: number): Promise<ConceptEntry[]> {
    if (this.loadedChunks.has(chunkIndex)) return [];
    const chunkFile = `index-${String(chunkIndex).padStart(4, '0')}.json`;
    const resp = await fetch(`${this.baseUrl}/chunks/${chunkFile}`);
    if (!resp.ok) throw new Error(`Failed to load chunk ${chunkIndex} for ${this.registerId}`);
    const data = await resp.json();
    this.loadedChunks.add(chunkIndex);
    return data.concepts as ConceptEntry[];
  }

  private async loadChunkAsSummaries(chunkIndex: number): Promise<void> {
    if (this.loadedChunks.has(chunkIndex)) return;

    const chunkFile = `index-${String(chunkIndex).padStart(4, '0')}.json`;
    const resp = await fetch(`${this.baseUrl}/chunks/${chunkFile}`);
    if (!resp.ok) return;
    const data = await resp.json();
    this.loadedChunks.add(chunkIndex);

    const entries = data.concepts as ConceptEntry[];
    const startPos = chunkIndex * (this.indexMeta?.chunkSize ?? 500);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const summary: ConceptSummary = {
        id: entry.id,
        eng: entry.designations?.eng || Object.values(entry.designations || {})[0] || '',
        status: entry.status,
      };
      (this.index!.concepts as (ConceptSummary | undefined)[])[startPos + i] = summary;
      this.summaryMap.set(entry.id, summary);
      this.positionIndex.set(entry.id, startPos + i);
    }
  }

  async ensureChunksForRange(offset: number, limit: number): Promise<void> {
    if (!this.indexMeta) return;
    const { chunkSize, chunks } = this.indexMeta;
    const firstChunk = Math.floor(offset / chunkSize);
    const lastChunk = Math.floor((offset + limit - 1) / chunkSize);
    const toLoad: number[] = [];
    for (let c = firstChunk; c <= Math.min(lastChunk, chunks.length - 1); c++) {
      if (!this.loadedChunks.has(c)) toLoad.push(c);
    }
    if (toLoad.length === 0) return;
    await Promise.all(toLoad.map(c => this.loadChunkAsSummaries(c)));
  }

  async ensureAllChunksLoaded(): Promise<void> {
    if (!this.indexMeta) return;
    const { chunks } = this.indexMeta;
    const toLoad = chunks.map((_, i) => i).filter(i => !this.loadedChunks.has(i));
    // Load in parallel batches of 5 to avoid overwhelming the browser
    for (let i = 0; i < toLoad.length; i += 5) {
      const batch = toLoad.slice(i, i + 5);
      await Promise.all(batch.map(c => this.loadChunkAsSummaries(c)));
    }
  }

  isRangeLoaded(offset: number, limit: number): boolean {
    if (!this.index?.concepts) return false;
    const arr = this.index.concepts as (ConceptSummary | undefined)[];
    for (let i = offset; i < Math.min(offset + limit, arr.length); i++) {
      if (arr[i] === undefined) return false;
    }
    return true;
  }

  async fetchConcept(conceptId: string): Promise<ConceptDocument> {
    const cached = this.conceptCache.get(conceptId);
    if (cached) return cached;

    const resp = await fetch(`${this.baseUrl}/concepts/${conceptId}.json`);
    if (!resp.ok) throw new Error(`Concept ${conceptId} not found in ${this.registerId}`);
    const doc = (await resp.json()) as ConceptDocument;
    this.conceptCache.set(conceptId, doc);
    return doc;
  }

  getIndexEntry(conceptId: string): ConceptSummary | undefined {
    return this.summaryMap.get(conceptId);
  }

  getConcepts(): ConceptSummary[] {
    return this.index?.concepts ?? [];
  }

  getConceptCount(): number {
    return this.index?.conceptCount ?? this.indexMeta?.conceptCount ?? 0;
  }

  getConceptPosition(conceptId: string): number {
    return this.positionIndex.get(conceptId) ?? -1;
  }

  getAdjacentConcepts(conceptId: string): { prev: string | null; next: string | null } {
    const concepts = this.index?.concepts as (ConceptSummary | undefined)[] | undefined;
    if (!concepts) return { prev: null, next: null };
    const idx = this.getConceptPosition(conceptId);
    if (idx === -1) return { prev: null, next: null };
    // Scan backward for prev (skip undefined)
    let prev: string | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (concepts[i]) { prev = concepts[i]!.id; break; }
    }
    // Scan forward for next (skip undefined)
    let next: string | null = null;
    for (let i = idx + 1; i < concepts.length; i++) {
      if (concepts[i]) { next = concepts[i]!.id; break; }
    }
    return { prev, next };
  }

  search(query: string, lang: string = 'eng'): SearchHit[] {
    const q = query.toLowerCase();
    const hits: SearchHit[] = [];
    const arr = this.index?.concepts as (ConceptSummary | undefined)[] | undefined;
    if (!arr) return hits;

    for (const entry of arr) {
      if (!entry) continue;
      const term = entry.eng || '';
      if (term.toLowerCase().includes(q) || entry.id.toLowerCase().includes(q)) {
        hits.push({
          conceptId: entry.id,
          registerId: this.registerId,
          designation: term,
          language: lang,
          matchField: 'designation',
        });
      }
    }
    return hits;
  }

  extractEdges(concept: ConceptDocument): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const sourceUri = concept['@id'];

    for (const [_lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
      if (lc['gl:references']) {
        for (const ref of lc['gl:references']) {
          if (ref['@id'] && ref['@id'] !== sourceUri) {
            const parsed = UriRouter.parseUri(ref['@id']);
            edges.push({
              source: sourceUri,
              target: ref['@id'],
              type: 'references',
              label: ref['gl:term'],
              register: parsed?.registerId ?? this.registerId,
            });
          }
        }
      }
    }

    return edges;
  }

  async loadEdgeIndex(): Promise<GraphEdge[]> {
    const resp = await fetch(`${this.baseUrl}/edges.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.edges ?? [];
  }

  async loadGraphNodes(): Promise<{ uriPrefix: string; nodes: [string, string, string, string][] }> {
    const resp = await fetch(`${this.baseUrl}/graph-nodes.json`);
    if (!resp.ok) return { uriPrefix: '', nodes: [] };
    return await resp.json();
  }

  getLanguages(): string[] {
    return this.manifest?.languages ?? [];
  }
}
