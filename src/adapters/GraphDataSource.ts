import type { GraphEdge, GraphNode, PartitiveRelationWire, SectionNode } from './types';
import type { Concept, RelatedConcept } from 'glossarist';
import type { DatasetAdapter } from './DatasetAdapter';
import { UriRouter } from './UriRouter';
import { slugify } from '../utils/slugify';
import { toSectionNode, toSectionTree } from '../utils/section-tree';
import { ConceptIdentity } from './concept-identity';

interface DomainNodeJson {
  uri?: string;
  id?: string;
  registerId?: string;
  label?: string;
  names?: Record<string, string>;
  conceptCount?: number;
  children?: DomainNodeJson[];
}

export function resolveRefTarget(rc: RelatedConcept, uriBase: string, registerId: string, urnMap?: ReadonlyMap<string, string>): string {
  // Prefer the native target field — already resolved at build time
  // via refPrefixMap in generate-data.ts. This is the author-provided
  // canonical URL for cross-dataset relations.
  if (rc.target) return rc.target;

  // Fallback: resolve from ref (for data generated before gl:target existed)
  if (!rc.ref) return '';
  const ref = rc.ref;
  if (ref.id) {
    let reg = registerId;
    if (ref.source && !ref.source.startsWith('http')) {
      reg = urnMap?.get(ref.source) ?? ref.source;
    }
    return new ConceptIdentity(ref.id, reg, uriBase).uri;
  }
  if (ref.source && ref.source.startsWith('http')) return ref.source;
  return ref.source || '';
}

function contentLabel(content: unknown): string | undefined {
  if (content == null) return undefined;
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, string>;
    return obj.default ?? obj.eng ?? Object.values(obj)[0];
  }
  return undefined;
}

export class GraphDataSource {
  constructor(private adapter: DatasetAdapter) {}

  private get baseUrl(): string {
    return this.adapter.dataUrl;
  }

  private get registerId(): string {
    return this.adapter.registerId;
  }

  private get uriBase(): string {
    const uriBase = this.adapter.manifest?.uriBase;
    if (!uriBase) throw new Error('GraphDataSource: manifest.uriBase is required');
    return uriBase;
  }

  private get urnMap(): ReadonlyMap<string, string> {
    return this.adapter.urnMap;
  }

  async loadEdgeIndex(): Promise<GraphEdge[]> {
    const resp = await fetch(`${this.baseUrl}/edges.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.edges ?? [];
  }

  async loadPartitiveRelations(): Promise<PartitiveRelationWire[]> {
    const resp = await fetch(`${this.baseUrl}/partitive_relations.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.relations ?? data.hyperedges ?? [];
  }

  async loadGraphNodes(): Promise<{ uriPrefix: string; nodes: [string, Record<string, string>, string][] }> {
    const resp = await fetch(`${this.baseUrl}/graph-nodes.json`);
    if (!resp.ok) return { uriPrefix: '', nodes: [] };
    return await resp.json();
  }

  async loadDomainNodes(): Promise<GraphNode[]> {
    const resp = await fetch(`${this.baseUrl}/domain-nodes.json`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.domainNodes || []).map((dn: DomainNodeJson) => this.mapDomainNode(dn));
  }

  extractEdges(concept: Concept): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const sourceUri = concept.uri || UriRouter.buildConceptUri(this.uriBase, this.registerId, concept.id);

    for (const rc of concept.relatedConcepts) {
      const target = resolveRefTarget(rc, this.uriBase, this.registerId, this.urnMap);
      if (target && target !== sourceUri) {
        const parsed = UriRouter.parseUri(target);
        edges.push({
          source: sourceUri,
          target,
          type: rc.type || 'references',
          label: contentLabel(rc.content),
          register: parsed?.registerId ?? this.registerId,
        });
      }
    }

    for (const lang of concept.languages) {
      const lc = concept.localization(lang);
      if (!lc) continue;
      for (const rc of lc.related) {
        const target = resolveRefTarget(rc, this.uriBase, this.registerId, this.urnMap);
        if (target && target !== sourceUri) {
          const parsed = UriRouter.parseUri(target);
          edges.push({
            source: sourceUri,
            target,
            type: rc.type || 'references',
            label: contentLabel(rc.content),
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
    const sourceUri = concept.uri || UriRouter.buildConceptUri(this.uriBase, this.registerId, concept.id);

    for (const lang of concept.languages) {
      const lc = concept.localization(lang);
      if (lc?.domain) {
        edges.push({
          source: sourceUri,
          target: UriRouter.buildDomainUri(this.uriBase, this.registerId, slugify(lc.domain)),
          type: 'domain',
          label: lc.domain,
          register: this.registerId,
          lang,
        });
      }
    }
    return edges;
  }

  getSectionTree(): SectionNode[] {
    const nodes = this.adapter.manifest?.sections;
    if (!nodes || nodes.length === 0) return [];
    return toSectionTree(nodes);
  }

  private mapDomainNode(dn: DomainNodeJson): GraphNode {
    const node: GraphNode = {
      uri: dn.uri ?? '',
      register: dn.registerId ?? '',
      conceptId: dn.uri?.split('/domain/')[1] || dn.id || '',
      designations: dn.names || (dn.label ? { eng: dn.label } : {}),
      status: 'domain',
      loaded: true,
      nodeType: 'domain' as const,
      conceptCount: dn.conceptCount || 0,
    };
    if (dn.children && dn.children.length > 0) {
      node.children = dn.children.map(c => this.domainNodeToSection(c));
    }
    return node;
  }

  private domainNodeToSection(dn: DomainNodeJson): SectionNode {
    return toSectionNode({
      id: dn.id,
      names: dn.names || (dn.label ? { eng: dn.label } : {}),
      conceptCount: dn.conceptCount,
      children: dn.children,
    });
  }
}
