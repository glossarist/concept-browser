import type { GraphEdge, GraphNode, SectionNode } from './types';
import type { Concept, RelatedConcept } from 'glossarist';
import type { DatasetAdapter } from './DatasetAdapter';
import { UriRouter } from './UriRouter';
import { slugify } from '../utils/slugify';

interface DomainNodeJson {
  uri?: string;
  id?: string;
  registerId?: string;
  label?: string;
  names?: Record<string, string>;
  conceptCount?: number;
  children?: DomainNodeJson[];
}

interface SectionJson {
  id: string;
  names?: Record<string, string>;
  children?: SectionJson[];
}

function resolveRefTarget(rc: RelatedConcept, uriBase: string, registerId: string, urnMap?: ReadonlyMap<string, string>): string {
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

export class GraphDataSource {
  constructor(private adapter: DatasetAdapter) {}

  private get baseUrl(): string {
    return this.adapter.dataUrl;
  }

  private get registerId(): string {
    return this.adapter.registerId;
  }

  private get uriBase(): string {
    return this.adapter.manifest?.uriBase || 'https://glossarist.org';
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
    const sourceUri = concept.uri || `${this.uriBase}/${this.registerId}/concept/${concept.id}`;

    for (const rc of concept.relatedConcepts) {
      const target = resolveRefTarget(rc, this.uriBase, this.registerId, this.urnMap);
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
    const sourceUri = concept.uri || `${this.uriBase}/${this.registerId}/concept/${concept.id}`;

    for (const lang of concept.languages) {
      const lc = concept.localization(lang);
      if (lc?.domain) {
        edges.push({
          source: sourceUri,
          target: `${this.uriBase}/${this.registerId}/domain/${slugify(lc.domain)}`,
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
    return nodes.map(s => this.mapManifestSection(s));
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
      node.children = dn.children.map((c) => this.mapSectionNode(c));
    }
    return node;
  }

  private mapSectionNode(dn: DomainNodeJson): SectionNode {
    const node: SectionNode = {
      id: dn.id ?? '',
      names: dn.names || (dn.label ? { eng: dn.label } : {}),
      conceptCount: dn.conceptCount || 0,
    };
    if (dn.children && dn.children.length > 0) {
      node.children = dn.children.map((c) => this.mapSectionNode(c));
    }
    return node;
  }

  private mapManifestSection(s: SectionJson): SectionNode {
    const node: SectionNode = { id: s.id, names: s.names || {}, conceptCount: 0 };
    if (s.children && s.children.length > 0) {
      node.children = s.children.map(c => this.mapManifestSection(c));
    }
    return node;
  }
}
