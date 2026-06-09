import { computed, type ComputedRef } from 'vue';
import type { Concept, RelatedConcept } from 'glossarist';
import type { Manifest, GraphEdge } from '../adapters/types';
import { getFactory } from '../adapters/factory';
import { conceptUri } from '../adapters/model-bridge';
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
      const tooltipLines: string[] = [uri];
      if (node) {
        for (const [lang, des] of Object.entries(node.designations)) {
          tooltipLines.push(`${langLabel(lang)}: ${des}`);
        }
      }
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
    return [...direct, ...derived];
  });

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
    const router = (await import('vue-router')).useRouter();

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
    const router = (await import('vue-router')).useRouter();
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
    resolveRelatedRef,
    getResolvedRef,
    relatedLabel,
    navigateEdge,
    navigateRelated,
  };
}
