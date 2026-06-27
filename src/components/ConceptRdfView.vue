<script setup lang="ts">
import { computed } from 'vue';
import type { Concept } from 'glossarist';
import RdfInstanceHeader from './concept-rdf/RdfInstanceHeader.vue';
import RdfInstanceSection from './concept-rdf/RdfInstanceSection.vue';
import RdfSourcePanel from './concept-rdf/RdfSourcePanel.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import { useRdfDocument } from './concept-rdf/use-rdf-document';

const props = defineProps<{
  concept: Concept;
  registerId: string;
  conceptUriValue: string;
}>();

const { sections, turtle, jsonld, typeChain } = useRdfDocument(
  () => props.concept,
  () => props.conceptUriValue,
);

const resourceCount = computed(() => sections.value.length);
const conceptId = computed(() => props.concept.id);
</script>

<template>
  <ErrorBoundary title="RDF view failed" :retry-key="conceptUriValue">
    <div class="space-y-6">
      <div class="card p-5">
        <div class="flex items-start justify-between gap-3">
          <RdfInstanceHeader :uri="conceptUriValue" :concept-id="conceptId" />
        </div>
        <div class="mt-4 pt-3 border-t border-ink-100/60">
          <div class="flex items-center gap-1.5 flex-wrap text-xs text-ink-400">
            <template v-for="(t, i) in typeChain" :key="i">
              <span v-if="i > 0" class="text-ink-200 mx-0.5">→</span>
              <code class="text-[11px] text-ink-400">{{ t }}</code>
            </template>
            <span class="text-ink-200 mx-0.5">→</span>
            <code class="text-[11px] text-ink-700 font-semibold bg-ink-50 px-1.5 py-0.5 rounded">{{ concept.id }}</code>
          </div>
        </div>
      </div>

      <RdfInstanceSection
        v-for="(section, si) in sections"
        :key="si"
        :section="section"
      />

      <RdfSourcePanel
        :turtle="turtle"
        :jsonld="jsonld"
        :resource-count="resourceCount"
      />
    </div>
  </ErrorBoundary>
</template>
