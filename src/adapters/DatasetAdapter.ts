import type {
  Manifest,
  ConceptIndex,
  ConceptSummary,
  ConceptEntry,
  SearchHit,
  GraphEdge,
  GraphNode,
  SectionNode,
  DatasetSummary,
} from './types';
import type { Concept } from 'glossarist';
import { conceptFromJson } from './model-bridge';
import { GraphDataSource } from './GraphDataSource';

// ── Wire-format types for JSON responses ────────────────────────────────────

interface IndexJson {
  registerId: string;
  schemaVersion: string;
  conceptCount: number;
  chunkSize: number;
  chunks: { file: string; count: number }[];
  concepts: IndexConceptJson[];
}

interface IndexConceptJson {
  id: string;
  designations?: Record<string, string>;
  eng?: string;
  status: string;
  groups?: string[];
}

export class DatasetAdapter {
  private positionIndex = new Map<string, number>();
  private _urnMap: ReadonlyMap<string, string> = new Map();
  readonly registerId: string;
  private baseUrl: string;
  manifest: Manifest | null = null;
  index: ConceptIndex | null = null;
  private manifestComplete = false;

  private conceptCache = new Map<string, Concept>();
  private static MAX_CACHE = 100;
  private summaryMap = new Map<string, ConceptSummary>();
  private designationMap = new Map<string, string>();
  private loadedChunks = new Set<number>();
  private indexMeta: { conceptCount: number; chunkSize: number; chunks: { file: string; count: number }[] } | null = null;

  constructor(registerId: string, baseUrl: string) {
    this.registerId = registerId;
    this.baseUrl = baseUrl;
  }

  setSummaryManifest(summary: DatasetSummary, registry?: { datasetUri?: string; uriBase?: string; uriAliases?: string[] }): void {
    this.manifest = {
      id: this.registerId,
      datasetUri: registry?.datasetUri || '',
      title: summary.title,
      description: summary.description,
      owner: summary.owner,
      baseUrl: this.baseUrl,
      languages: summary.languages,
      conceptCount: summary.conceptCount,
      conceptUrlTemplate: '',
      indexUrl: '',
      contextUrl: '',
      uriBase: registry?.uriBase || '',
      uriAliases: registry?.uriAliases,
      status: '',
      schemaVersion: '',
      tags: summary.tags,
      lastUpdated: '',
      sourceRepo: '',
      chunkSize: 1000,
      color: summary.color,
    };
    this.manifestComplete = false;
  }

  async loadManifest(): Promise<Manifest> {
    if (this.manifestComplete && this.manifest) return this.manifest;
    const resp = await fetch(`${this.baseUrl}/manifest.json`);
    if (!resp.ok) throw new Error(`Failed to load manifest for ${this.registerId}: ${resp.status}`);
    this.manifest = (await resp.json()) as Manifest;
    this.manifestComplete = true;
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
    const data = await resp.json();

    // Handle both old format (with eng/status fields) and new format (with designations map)
    this.index = this.normalizeIndex(data as IndexJson);
    this.buildSummaryIndex();
    return this.index;
  }

  private normalizeIndex(data: IndexJson): ConceptIndex {
    const concepts: ConceptSummary[] = (data.concepts || []).map((c) => ({
      id: c.id,
      designations: c.designations || {},
      eng: c.eng || c.designations?.eng || Object.values(c.designations || {})[0] || '',
      status: c.status,
      groups: c.groups || [],
    }));

    return {
      registerId: data.registerId,
      schemaVersion: data.schemaVersion,
      conceptCount: data.conceptCount,
      chunkSize: data.chunkSize,
      chunks: data.chunks || [],
      concepts,
    };
  }

  private buildSummaryIndex() {
    this.summaryMap.clear();
    this.positionIndex.clear();
    this.designationMap.clear();
    for (let i = 0; i < this.index!.concepts.length; i++) {
      const entry = this.index!.concepts[i];
      if (entry) {
        this.summaryMap.set(entry.id, entry);
        this.positionIndex.set(entry.id, i);
        for (const term of Object.values(entry.designations)) {
          if (term && !this.designationMap.has(term.toLowerCase())) {
            this.designationMap.set(term.toLowerCase(), entry.id);
          }
        }
      }
    }
  }

  private async loadIndexChunked(): Promise<ConceptIndex> {
    const metaResp = await fetch(`${this.baseUrl}/index-meta.json`);
    let meta: { registerId: string; schemaVersion: string; conceptCount: number; chunkSize: number; chunks: { file: string; count: number }[] };
    if (metaResp.ok) {
      meta = await metaResp.json();
    } else {
      const resp = await fetch(`${this.baseUrl}/index.json`);
      if (!resp.ok) throw new Error(`Failed to load index for ${this.registerId}`);
      const data = await resp.json();
      this.index = this.normalizeIndex(data as IndexJson);
      this.buildSummaryIndex();
      return this.index;
    }

    this.indexMeta = {
      conceptCount: meta.conceptCount,
      chunkSize: meta.chunkSize,
      chunks: meta.chunks,
    };

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
      const designations = entry.designations || (entry.groups ? {} : { eng: '' });
      const summary: ConceptSummary = {
        id: entry.id,
        designations,
        eng: designations.eng || Object.values(designations)[0] || '',
        status: entry.status,
        groups: entry.groups || [],
      };
      this.index!.concepts[startPos + i] = summary;
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
    for (let i = 0; i < toLoad.length; i += 5) {
      const batch = toLoad.slice(i, i + 5);
      await Promise.all(batch.map(c => this.loadChunkAsSummaries(c)));
    }
  }

  isRangeLoaded(offset: number, limit: number): boolean {
    if (!this.index?.concepts) return false;
    const arr = this.index.concepts;
    for (let i = offset; i < Math.min(offset + limit, arr.length); i++) {
      if (arr[i] === undefined) return false;
    }
    return true;
  }

  async fetchConcept(conceptId: string): Promise<Concept> {
    const cached = this.conceptCache.get(conceptId);
    if (cached) {
      this.conceptCache.delete(conceptId);
      this.conceptCache.set(conceptId, cached);
      return cached;
    }

    const resp = await fetch(`${this.baseUrl}/concepts/${conceptId}.json`);
    if (!resp.ok) throw new Error(`Concept ${conceptId} not found in ${this.registerId}`);
    const json = await resp.json();
    const concept = conceptFromJson(json);
    this.conceptCache.set(conceptId, concept);
    if (this.conceptCache.size > DatasetAdapter.MAX_CACHE) {
      const oldest = this.conceptCache.keys().next().value;
      if (oldest !== undefined) this.conceptCache.delete(oldest);
    }
    return concept;
  }

  getIndexEntry(conceptId: string): ConceptSummary | undefined {
    return this.summaryMap.get(conceptId);
  }

  /** Look up a concept ID by its designation string (case-insensitive). */
  lookupByDesignation(designation: string): string | undefined {
    return this.designationMap.get(designation.toLowerCase());
  }

  getConcepts(): (ConceptSummary | undefined)[] {
    return this.index?.concepts ?? [];
  }

  getConceptCount(): number {
    return this.index?.conceptCount ?? this.indexMeta?.conceptCount ?? 0;
  }

  getConceptPosition(conceptId: string): number {
    return this.positionIndex.get(conceptId) ?? -1;
  }

  getAdjacentConcepts(conceptId: string): { prev: string | null; next: string | null } {
    const concepts = this.index?.concepts;
    if (!concepts) return { prev: null, next: null };
    const idx = this.getConceptPosition(conceptId);
    if (idx === -1) return { prev: null, next: null };
    let prev: string | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (concepts[i]) { prev = concepts[i]!.id; break; }
    }
    let next: string | null = null;
    for (let i = idx + 1; i < concepts.length; i++) {
      if (concepts[i]) { next = concepts[i]!.id; break; }
    }
    return { prev, next };
  }

  search(query: string): SearchHit[] {
    const q = query.toLowerCase();
    const arr = this.index?.concepts;
    if (!arr) return [];

    type ScoredHit = SearchHit & { _score: number };
    const scored: ScoredHit[] = [];

    for (const entry of arr) {
      if (!entry) continue;

      // ID search — exact match highest, then starts with, then contains
      const idLow = entry.id.toLowerCase();
      if (idLow.includes(q)) {
        const score = idLow === q ? 4 : idLow.startsWith(q) ? 3 : 2;
        scored.push({
          conceptId: entry.id,
          registerId: this.registerId,
          designation: entry.eng || '',
          language: '',
          matchField: 'id',
          snippet: `ID: ${entry.id}`,
          _score: score,
        });
        continue;
      }

      // Multi-language designation search
      for (const [language, term] of Object.entries(entry.designations)) {
        if (!term) continue;
        const tLow = term.toLowerCase();
        if (tLow.includes(q)) {
          const score = tLow === q ? 4 : tLow.startsWith(q) ? 3 : 1;
          scored.push({
            conceptId: entry.id,
            registerId: this.registerId,
            designation: term,
            language,
            matchField: 'designation',
            _score: score,
          });
        }
      }
    }

    // Sort by score descending, then alphabetically
    scored.sort((a, b) => b._score - a._score || a.designation.localeCompare(b.designation));
    return scored;
  }

  setUrnMap(map: ReadonlyMap<string, string>): void {
    this._urnMap = map;
  }

  get dataUrl(): string {
    return this.baseUrl;
  }

  get urnMap(): ReadonlyMap<string, string> {
    return this._urnMap;
  }

  private _graphDataSource: GraphDataSource | null = null;
  get graphDataSource(): GraphDataSource {
    if (!this._graphDataSource) this._graphDataSource = new GraphDataSource(this);
    return this._graphDataSource;
  }

  extractEdges(concept: Concept): GraphEdge[] {
    return this.graphDataSource.extractEdges(concept);
  }

  extractDomainEdges(concept: Concept): GraphEdge[] {
    return this.graphDataSource.extractDomainEdges(concept);
  }

  async loadDomainNodes(): Promise<GraphNode[]> {
    return this.graphDataSource.loadDomainNodes();
  }

  async loadEdgeIndex(): Promise<GraphEdge[]> {
    return this.graphDataSource.loadEdgeIndex();
  }

  async loadGraphNodes(): Promise<{ uriPrefix: string; nodes: [string, Record<string, string>, string][] }> {
    return this.graphDataSource.loadGraphNodes();
  }

  getSectionTree(): SectionNode[] {
    return this.graphDataSource.getSectionTree();
  }

  getLanguages(): string[] {
    return this.manifest?.languages ?? [];
  }
}
