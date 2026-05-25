<script setup lang="ts">
import type { GraphEdge, Manifest } from '../adapters/types';
import { computed } from 'vue';
import { categorizeRelationship, relationshipLabel, RELATIONSHIP_CATEGORIES } from '../utils/relationship-categories';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';
import { langName } from '../utils/lang';

const props = defineProps<{
  edges: GraphEdge[];
  manifest: Manifest;
  registerId: string;
}>();

const emit = defineEmits<{
  (e: 'navigate', registerId: string, conceptId: string): void;
}>();

interface GroupedEdge extends GraphEdge {
  category: ReturnType<typeof categorizeRelationship>;
}

const groupedEdges = computed(() => {
  const outgoing: GroupedEdge[] = [];
  const incoming: GroupedEdge[] = [];

  // We can't distinguish incoming/outgoing from edges alone without the graph engine.
  // For now, treat all edges as outgoing from the current concept.
  for (const edge of props.edges) {
    const category = categorizeRelationship(edge.type);
    outgoing.push({ ...edge, category });
  }

  const byCategory = new Map<string, GroupedEdge[]>();
  for (const edge of outgoing) {
    const existing = byCategory.get(edge.category.id) ?? [];
    existing.push(edge);
    byCategory.set(edge.category.id, existing);
  }

  return byCategory;
});

const activeCategories = computed(() => {
  const categoryIds = new Set([...groupedEdges.value.keys()]);
  return RELATIONSHIP_CATEGORIES.filter(c => categoryIds.has(c.id))
    .concat(
      categoryIds.has('other')
        ? [{ id: 'other', label: 'Other', types: [], color: 'text-gray-600 bg-gray-50' }]
        : []
    );
});

const router = useRouter();
const store = useVocabularyStore();
const factory = getFactory();

function navigate(edge: GraphEdge) {
  const resolution = factory.resolve(edge.target);
  if (resolution.type === 'internal') {
    store.viewConcept(resolution.registerId, resolution.conceptId);
    router.push({ name: 'concept', params: { registerId: resolution.registerId, conceptId: resolution.conceptId } });
  } else if (resolution.type === 'site') {
    window.open(resolution.baseUrl + '/' + resolution.conceptUri, '_blank');
  }
}
</script>

<template>
  <div v-if="groupedEdges.size > 0" class="space-y-4">
    <div v-for="category in activeCategories" :key="category.id">
      <div class="section-label flex items-center gap-1.5 mb-2">
        <span class="inline-block w-2 h-2 rounded-full" :class="category.color"></span>
        {{ category.label }}
      </div>
      <div class="space-y-1.5">
        <button
          v-for="(edge, i) in groupedEdges.get(category.id)"
          :key="i"
          @click="navigate(edge)"
          class="block w-full text-left px-3 py-2 rounded-lg hover:bg-ink-50 transition-colors text-sm group"
        >
          <div class="flex items-center gap-2">
            <span class="badge text-[10px] flex-shrink-0" :class="category.color">
              {{ relationshipLabel(edge.type) }}
            </span>
            <span class="text-ink-700 group-hover:text-ink-900 truncate">
              {{ edge.label || edge.target }}
            </span>
            <span v-if="edge.lang" class="text-[10px] text-ink-300 ml-auto flex-shrink-0">
              {{ edge.lang }}
            </span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
