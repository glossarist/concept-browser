import type { GraphNode, GraphEdge } from '../adapters/types';
import { UriRouter } from '../adapters/UriRouter';

/**
 * Directed multigraph engine for concept relationships.
 * Supports cross-register edges with stub nodes for unresolved targets.
 */
export class GraphEngine {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private edgeKeys = new Set<string>();
  private adjacency = new Map<string, Map<string, GraphEdge[]>>();
  private reverseAdjacency = new Map<string, Map<string, GraphEdge[]>>();

  addNode(node: GraphNode): void {
    const existing = this.nodes.get(node.uri);
    if (!existing) {
      this.nodes.set(node.uri, node);
    } else if (node.loaded && !existing.loaded) {
      this.nodes.set(node.uri, node);
    }
  }

  addEdge(edge: GraphEdge): void {
    const key = `${edge.source}\0${edge.target}\0${edge.type}\0${edge.lang ?? ''}`;
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);

    const parsed = UriRouter.parseUri(edge.target);
    if (!this.nodes.has(edge.source)) {
      const sourceParsed = UriRouter.parseUri(edge.source);
      this.nodes.set(edge.source, {
        uri: edge.source,
        register: sourceParsed?.registerId ?? edge.register,
        conceptId: sourceParsed?.conceptId ?? '',
        designations: {},
        status: 'stub',
        loaded: false,
      });
    }
    if (!this.nodes.has(edge.target)) {
      const isDomain = edge.type === 'domain';
      this.nodes.set(edge.target, {
        uri: edge.target,
        register: isDomain ? edge.register : (parsed?.registerId ?? ''),
        conceptId: isDomain ? '' : (parsed?.conceptId ?? ''),
        designations: {},
        status: isDomain ? 'domain' : 'stub',
        loaded: false,
        nodeType: isDomain ? 'domain' : undefined,
      });
    }

    this.edges.push(edge);

    if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Map());
    const sourceAdj = this.adjacency.get(edge.source)!;
    if (!sourceAdj.has(edge.target)) sourceAdj.set(edge.target, []);
    sourceAdj.get(edge.target)!.push(edge);

    if (!this.reverseAdjacency.has(edge.target)) this.reverseAdjacency.set(edge.target, new Map());
    const targetAdj = this.reverseAdjacency.get(edge.target)!;
    if (!targetAdj.has(edge.source)) targetAdj.set(edge.source, []);
    targetAdj.get(edge.source)!.push(edge);
  }

  getNode(uri: string): GraphNode | undefined {
    return this.nodes.get(uri);
  }

  getEdges(from?: string): GraphEdge[] {
    if (from) {
      const adj = this.adjacency.get(from);
      if (!adj) return [];
      return [...adj.values()].flat();
    }
    return this.edges;
  }

  getIncomingEdges(uri: string): GraphEdge[] {
    const adj = this.reverseAdjacency.get(uri);
    if (!adj) return [];
    return [...adj.values()].flat();
  }

  getNeighbors(uri: string): { outgoing: string[]; incoming: string[] } {
    const outgoing: string[] = [];
    const adj = this.adjacency.get(uri);
    if (adj) for (const target of adj.keys()) outgoing.push(target);

    const incoming: string[] = [];
    const radj = this.reverseAdjacency.get(uri);
    if (radj) for (const source of radj.keys()) incoming.push(source);

    return { outgoing, incoming };
  }

  getSubgraph(rootUri: string, depth: number = 2): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const visited = new Set<string>();
    const collectedNodes: GraphNode[] = [];
    const collectedEdges: GraphEdge[] = [];
    const queue: { uri: string; d: number }[] = [{ uri: rootUri, d: 0 }];

    while (queue.length > 0) {
      const { uri, d } = queue.shift()!;
      if (visited.has(uri) || d > depth) continue;
      visited.add(uri);

      const node = this.nodes.get(uri);
      if (node) collectedNodes.push(node);
      if (node?.nodeType === 'domain') continue;

      const outEdges = this.getEdges(uri);
      for (const e of outEdges) {
        collectedEdges.push(e);
        if (!visited.has(e.target)) queue.push({ uri: e.target, d: d + 1 });
      }

      const inEdges = this.getIncomingEdges(uri);
      for (const e of inEdges) {
        collectedEdges.push(e);
        if (!visited.has(e.source)) queue.push({ uri: e.source, d: d + 1 });
      }
    }

    return { nodes: collectedNodes, edges: collectedEdges };
  }

  getAllNodes(): GraphNode[] {
    return [...this.nodes.values()];
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.length;
  }
}
