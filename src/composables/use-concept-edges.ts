import { computed, type ComputedRef } from 'vue';
import type { Router } from 'vue-router';
import type { Concept, PartitiveHyperedge as GlsPartitiveHyperedge, RelatedConcept } from 'glossarist';
import type { Manifest, GraphEdge, PartitiveHyperedge } from '../adapters/types';
import { getFactory } from '../adapters/factory';
import { conceptUri } from '../adapters/model-bridge';
import { UriRouter } from '../adapters/UriRouter';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { categorizeRelationship, relationshipLabel, INVERSE_RELATIONSHIPS } from '../utils/relationship-categories';
import { langLabel } from '../utils/lang';
import { escapeAttr } from '../utils/escape';
import { useI18n } from '../i18n';

export interface EdgeDisplay {
  uri: string;
  conceptId: string;
  designation: string;
  tooltip: string;
  isLocal: boolean;
  badge: { id: string; title: string } | null;
}

export function useConceptEdges(
  concept: ComputedRef<Concept>,
  registerId: ComputedRef<string>,
  manifest: ComputedRef<Manifest>,
  edges: ComputedRef<GraphEdge[]>,
  router: Router,
) {
  const factory = getFactory();
  const store = useVocabularyStore();
  const { getColor } = useDsStyle();
  const { locale } = useI18n();

  const conceptUriValue = computed(() =>
    conceptUri(concept.value, registerId.value, manifest.value.uriBase)
  );

  const outgoingEdges = computed(() =>
    store.graph.getUniqueEdges(conceptUriValue.value, 'outgoing', 'target')
      .filter(e => e.type !== 'domain' && e.type !== 'section')
  );

  const incomingEdges = computed(() =>
    store.graph.getUniqueEdges(conceptUriValue.value, 'incoming', 'source')
      .filter(e => e.type !== 'domain' && e.type !== 'section')
  );

  const edgeDisplayCache = computed(() => {
    const cache = new Map<string, EdgeDisplay>();
    for (const e of edges.value) {
      const uri = e.source === conceptUriValue.value ? e.target : e.source;
      if (cache.has(uri)) continue;
      const resolution = factory.resolve(uri, registerId.value);
      const isLocal = resolution.type === 'internal' && resolution.registerId === registerId.value;
      const conceptId = uri.match(/\/concept\/([^/]+)$/)?.[1] ?? uri.split('/').pop() ?? uri;
      const node = store.graph.getNode(uri);
      const designation = node
        ? (node.designations[locale.value] || node.designations.eng || Object.values(node.designations)[0] || '')
        : '';
      const tooltipLines: string[] = [conceptId];
      if (node) {
        for (const [lang, des] of Object.entries(node.designations)) {
          tooltipLines.push(`${langLabel(lang)}: ${des}`);
        }
      }
      tooltipLines.push(uri);
      let badge: { id: string; title: string } | null = null;
      if (resolution.type === 'internal' && resolution.registerId !== registerId.value) {
        const m = store.manifests.get(resolution.registerId);
        badge = { id: resolution.registerId, title: m?.shortname || m?.title || resolution.registerId };
      } else if (resolution.type === 'site') {
        badge = { id: '', title: resolution.label };
      } else if (resolution.type === 'url') {
        badge = { id: '', title: resolution.label };
      }
      cache.set(uri, { uri, conceptId, designation, tooltip: tooltipLines.join('\n'), isLocal, badge });
    }
    return cache;
  });

  function getEdgeDisplay(uri: string): EdgeDisplay {
    return edgeDisplayCache.value.get(uri) ?? { uri, conceptId: uri, designation: '', tooltip: uri, isLocal: false, badge: null };
  }

  function edgeBadgeColor(type: string, direction: 'out' | 'in'): string {
    if (type === 'supersedes' || type === 'superseded_by') {
      return direction === 'out' ? 'text-orange-700 bg-orange-50' : 'text-red-700 bg-red-50';
    }
    return categorizeRelationship(type).color;
  }

  function inverseEdgeType(type: string): string {
    return INVERSE_RELATIONSHIPS[type] || type;
  }

  // Concept-level related concepts (managed concept cross-references)
  const conceptRelated = computed(() => {
    const direct = concept.value.relatedConcepts?.filter(rc => !INVERSE_RELATIONSHIPS[rc.type]) ?? [];
    const derived = incomingEdges.value
      .filter(e => INVERSE_RELATIONSHIPS[e.type])
      .map(e => {
        const parsed = factory.resolve(e.source, registerId.value);
        const sourceUrn = parsed.type === 'internal'
          ? store.manifests.get(parsed.registerId)?.datasetUri
          : null;
        const conceptId = e.source.match(/\/concept\/([^/]+)$/)?.[1];
        return {
          type: INVERSE_RELATIONSHIPS[e.type],
          ref: sourceUrn && conceptId ? { source: sourceUrn, id: conceptId } : null,
          content: '',
        };
      });
    return [...direct, ...derived].filter(edge => {
      if (edge.type === 'broader_partitive' || edge.type === 'narrower_partitive') {
        const heUris = conceptPartitiveHyperedges.value;
        return !heUris.some(he => he.parts.includes(edge.ref as string) || he.comprehensive === edge.ref);
      }
      return true;
    });
  });

  const VALID_MARKERS = new Set(['double', 'dashed']);

  function validateHyperedgeMarkers(markers: Iterable<string>): ('double' | 'dashed')[] {
    const out: ('double' | 'dashed')[] = [];
    for (const m of markers) {
      if (!VALID_MARKERS.has(m)) {
        throw new Error(`Invalid partitive hyperedge marker: "${m}". Allowed: double, dashed`);
      }
      out.push(m as 'double' | 'dashed');
    }
    return out;
  }

  function resolveLocalizedContent(content: unknown): string | undefined {
    if (content == null) return undefined;
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, string>;
      return obj[registerId.value] ?? obj.default ?? obj.eng ?? Object.values(obj)[0];
    }
    return undefined;
  }

  // Concept-level partitive hyperedges (one-to-many decompositions).
  // Each hyperedge is resolved to concrete target URIs for display.
  // Independent of binary `conceptRelated` — see TODO.hyperedge/00.
  const conceptPartitiveHyperedges = computed<PartitiveHyperedge[]>(() => {
    const source = conceptUriValue.value;
    return (concept.value.partitiveHyperedges ?? [])
      .map((he: GlsPartitiveHyperedge): PartitiveHyperedge | null => {
        const comprehensive = resolveRefUri(he.comprehensive);
        if (!comprehensive) return null;
        const parts = he.parts
          .map(resolveRefUri)
          .filter((u): u is string => !!u && u !== source);
        if (parts.length === 0) return null;
        return {
          source,
          comprehensive,
          parts,
          enumeration: he.isOpen ? 'open' : 'closed',
          markers: validateHyperedgeMarkers(he.markers),
          label: resolveLocalizedContent(he.content),
          register: registerId.value,
        };
      })
      .filter((he): he is PartitiveHyperedge => he !== null);
  });

  function resolveRefUri(ref: { source?: string | null; id?: string | null } | null): string | null {
    const target = resolveRelatedRef(ref);
    if (!target) return null;
    const m = store.manifests.get(target.registerId);
    if (!m) return null;
    return UriRouter.buildConceptUri(m.uriBase, target.registerId, target.conceptId);
  }

  function resolveRelatedRef(ref: { source: string | null; id: string | null } | null) {
    return factory.resolveRelatedRef(ref, registerId.value);
  }

  const resolvedRefs = computed(() => {
    const map = new Map<string, { target: { registerId: string; conceptId: string } | null }>();
    for (const cr of conceptRelated.value) {
      const key = `${cr.ref?.source ?? ''}:${cr.ref?.id ?? ''}`;
      if (map.has(key)) continue;
      map.set(key, { target: resolveRelatedRef(cr.ref) });
    }
    return map;
  });

  function getResolvedRef(ref: { source: string | null; id: string | null } | null) {
    if (!ref) return { target: null };
    const key = `${ref.source ?? ''}:${ref.id ?? ''}`;
    return resolvedRefs.value.get(key) ?? { target: resolveRelatedRef(ref) };
  }

  function relatedLabel(dr: { content?: string | null; ref?: { source: string | null; id: string | null } | null }): string {
    if (dr.content) return dr.content;
    const resolved = dr.ref ? getResolvedRef(dr.ref).target : null;
    if (resolved) {
      const m = store.manifests.get(resolved.registerId);
      const dsLabel = m?.shortname || m?.title || resolved.registerId;
      return `${resolved.conceptId} (${dsLabel})`;
    }
    return dr.ref ? `${dr.ref.id || ''} (${dr.ref.source || ''})`.trim() : '';
  }

  async function navigateEdge(edge: GraphEdge) {
    const uri = edge.source === conceptUriValue.value ? edge.target : edge.source;
    const resolution = factory.resolve(uri);

    if (resolution.type === 'internal') {
      router.push({ name: 'concept', params: { registerId: resolution.registerId, conceptId: resolution.conceptId } });
    } else if (resolution.type === 'site') {
      window.open(`${resolution.baseUrl}/resolve/${encodeURIComponent(uri)}`, '_blank', 'noopener');
    } else if (resolution.type === 'url') {
      window.open(resolution.url, '_blank', 'noopener');
    }
  }

  async function navigateRelated(ref: { source: string | null; id: string | null }) {
    const target = resolveRelatedRef(ref);
    if (!target) return;
    router.push({ name: 'concept', params: { registerId: target.registerId, conceptId: target.conceptId } });
  }

  return {
    conceptUriValue,
    outgoingEdges,
    incomingEdges,
    edgeDisplayCache,
    getEdgeDisplay,
    edgeBadgeColor,
    inverseEdgeType,
    conceptRelated,
    conceptPartitiveHyperedges,
    resolveRelatedRef,
    getResolvedRef,
    relatedLabel,
    navigateEdge,
    navigateRelated,
  };
}
