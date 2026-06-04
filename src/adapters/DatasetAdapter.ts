import type {
  Manifest,
  ConceptIndex,
  ConceptSummary,
  ConceptEntry,
  SearchHit,
  GraphEdge,
  GraphNode,
} from './types';
import type { Concept, LocalizedConcept, Designation } from 'glossarist';
import { conceptFromJson, conceptUri } from './model-bridge';
import { UriRouter } from './UriRouter';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s/]+/g, '-');
}

function resolveRefTarget(rc: any, uriBase: string, registerId: string, urnMap?: ReadonlyMap<string, string>): string {
  if (!rc.ref) return '';
  const ref = rc.ref;
  if (ref.id) {
    let reg = registerId;
    if (ref.source && !ref.source.startsWith('http')) {
      reg = urnMap?.get(ref.source) ?? ref.source;
    }
    return `${uriBase}/${reg}/concept/${ref.id}`;
  }
  if (ref.source && ref.source.startsWith('http')) return ref.source;
  return ref.source || '';
}

export class DatasetAdapter {
  private positionIndex = new Map<string, number>();
  private _urnMap: ReadonlyMap<string, string> = new Map();
  readonly registerId: string;
  private baseUrl: string;
  manifest: Manifest | null = null;
  index: ConceptIndex | null = null;

  private conceptCache = new Map<string, Concept>();
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
    const data = await resp.json();

    // Handle both old format (with eng/status fields) and new format (with designations map)
    this.index = this.normalizeIndex(data);
    this.buildSummaryIndex();
    return this.index;
  }

  private normalizeIndex(data: any): ConceptIndex {
    const concepts: ConceptSummary[] = (data.concepts || []).map((c: any) => ({
      id: c.id,
      designations: c.designations || {},
      eng: c.eng || c.designations?.eng || Object.values(c.designations || {})[0] || '',
      status: c.status,
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
    for (let i = 0; i < this.index!.concepts.length; i++) {
      const entry = this.index!.concepts[i];
      if (entry) {
        this.summaryMap.set(entry.id, entry);
        this.positionIndex.set(entry.id, i);
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
      this.index = this.normalizeIndex(data);
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
    if (cached) return cached;

    const resp = await fetch(`${this.baseUrl}/concepts/${conceptId}.json`);
    if (!resp.ok) throw new Error(`Concept ${conceptId} not found in ${this.registerId}`);
    const json = await resp.json();
    const concept = conceptFromJson(json);
    this.conceptCache.set(conceptId, concept);
    return concept;
  }

  getIndexEntry(conceptId: string): ConceptSummary | undefined {
    return this.summaryMap.get(conceptId);
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

  extractEdges(concept: Concept): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const uriBase = this.manifest?.uriBase || 'https://glossarist.org';
    const sourceUri = concept.uri || `${uriBase}/${this.registerId}/concept/${concept.id}`;

    // Managed concept level relationships
    for (const rc of concept.relatedConcepts) {
      const target = resolveRefTarget(rc, uriBase, this.registerId, this._urnMap);
      if (target && target !== sourceUri) {
        const parsed = UriRouter.parseUri(target);
        edges.push({
          source: sourceUri,
          target,
          type: rc.type || 'references',
          label: rc.content || undefined,
          register: parsed?.registerId ?? this.registerId,
        });
      }
    }

    // Per-localization references (from inline extraction in generate-data)
    for (const lang of concept.languages) {
      const lc = concept.localization(lang);
      if (!lc) continue;
      for (const rc of lc.related) {
        const target = resolveRefTarget(rc, uriBase, this.registerId, this._urnMap);
        if (target && target !== sourceUri) {
          const parsed = UriRouter.parseUri(target);
          edges.push({
            source: sourceUri,
            target,
            type: rc.type || 'references',
            label: rc.content || undefined,
            register: parsed?.registerId ?? this.registerId,
            lang,
          });
        }
      }
    }

    return edges;
  }

  extractDomainEdges(concept: Concept): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const uriBase = this.manifest?.uriBase || 'https://glossarist.org';
    const sourceUri = concept.uri || `${uriBase}/${this.registerId}/concept/${concept.id}`;

    for (const lang of concept.languages) {
      const lc = concept.localization(lang);
      if (lc?.domain) {
        edges.push({
          source: sourceUri,
          target: `${uriBase}/${this.registerId}/domain/${slugify(lc.domain)}`,
          type: 'domain',
          label: lc.domain,
          register: this.registerId,
          lang,
        });
      }
    }
    return edges;
  }

  async loadDomainNodes(): Promise<GraphNode[]> {
    const resp = await fetch(`${this.baseUrl}/domain-nodes.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.domainNodes || []).map((dn: any) => ({
      uri: dn.uri,
      register: dn.registerId,
      conceptId: dn.uri.split('/domain/')[1] || '',
      designations: { eng: dn.label },
      status: 'domain',
      loaded: true,
      nodeType: 'domain' as const,
    }));
  }

  async loadEdgeIndex(): Promise<GraphEdge[]> {
    const resp = await fetch(`${this.baseUrl}/edges.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.edges ?? [];
  }

  async loadGraphNodes(): Promise<{ uriPrefix: string; nodes: [string, Record<string, string>, string][] }> {
    const resp = await fetch(`${this.baseUrl}/graph-nodes.json`);
    if (!resp.ok) return { uriPrefix: '', nodes: [] };
    return await resp.json();
  }

  getLanguages(): string[] {
    return this.manifest?.languages ?? [];
  }
}
