<script setup lang="ts">
import type { LocalizedConcept, Designation, ConceptSource } from '../adapters/types';
import { computed } from 'vue';
import { langName, langLabel } from '../utils/lang';
import { renderMath } from '../utils/math';
import type { RenderOptions } from '../utils/math';
import { escapeAttr } from '../utils/escape';
import { entryStatusColor, designationTypeLabel, designationTypeColor } from '../utils/concept-helpers';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';

const props = defineProps<{
  localizedConcepts: Record<string, LocalizedConcept>;
  activeLang: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeLang', lang: string): void;
}>();

const lc = computed(() => props.localizedConcepts[props.activeLang]);
const availableLangs = computed(() => Object.keys(props.localizedConcepts).sort());

const designations = computed(() => lc.value?.['gl:designation'] ?? []);
const definition = computed(() => {
  const defs = lc.value?.['gl:definition'];
  if (defs?.length) {
    const content = defs.map(d => d['gl:content']).filter(Boolean).join('\n\n');
    if (content) return content;
  }
  return '';
});
const notes = computed(() => {
  return lc.value?.['gl:notes']?.map(n => n['gl:content']).filter(Boolean) ?? [];
});
const examples = computed(() => lc.value?.['gl:examples']?.map(e => e['gl:content']).filter(Boolean) ?? []);
const sources = computed(() => lc.value?.['gl:source'] ?? []);

const hasContent = computed(() =>
  definition.value || notes.value.length > 0 || examples.value.length > 0 || designations.value.length > 1
);

const isTermOnly = computed(() =>
  !definition.value && notes.value.length === 0 && examples.value.length === 0
);

function normativeStatus(status: string): string {
  return status === 'preferred' ? 'Preferred' : status;
}
function normativeColor(status: string): string {
  if (status === 'preferred') return 'bg-emerald-50 text-emerald-700';
  if (status === 'deprecated') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

const router = useRouter();
const store = useVocabularyStore();

const factory = getFactory();

const renderOpts: RenderOptions = {
  xrefResolver: (uri, term) => {
    return `<a href="#" class="xref-link" data-uri="${escapeAttr(uri)}">${escapeAttr(term)}</a>`;
  },
  bibResolver: (refId, title) => {
    return `<span class="bib-ref">${escapeAttr(title)}</span>`;
  },
  figResolver: (figId) => {
    return `<span class="fig-ref">${escapeAttr(figId)}</span>`;
  },
};

function handleContentClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.xref-link') as HTMLElement | null;
  if (!target) return;
  e.preventDefault();
  const uri = target.dataset.uri;
  if (uri) {
    const resolution = factory.resolve(uri);
    if (resolution.type === 'internal') {
      store.viewConcept(resolution.registerId, resolution.conceptId);
      router.push({ name: 'concept', params: { registerId: resolution.registerId, conceptId: resolution.conceptId } });
    }
  }
}
</script>

<template>
  <div v-math class="space-y-5" @click="handleContentClick">
    <!-- Language selector -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="lang in availableLangs"
        :key="lang"
        @click="emit('update:activeLang', lang)"
        :class="[
          activeLang === lang
            ? 'bg-ink-800 text-white'
            : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'
        ]"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
      >
        <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langLabel(lang) }}</span>
        {{ langName(lang) }}
      </button>
    </div>

    <!-- Content for selected language -->
    <div v-if="lc">
      <!-- Entry status -->
      <div v-if="lc['gl:entryStatus']" class="flex items-center gap-2 mb-4">
        <span class="badge" :class="entryStatusColor(lc['gl:entryStatus'])">{{ lc['gl:entryStatus'] }}</span>
      </div>

      <!-- Designations -->
      <div v-if="designations.length > 0" class="card p-5">
        <div class="section-label">Designations</div>
        <div class="space-y-2 mt-3">
          <div v-for="(d, i) in designations" :key="i" class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-ink-800 text-lg" v-html="renderMath(d['gl:term'])"></span>
            <span class="badge text-[10px]" :class="designationTypeColor(d['@type'])">{{ designationTypeLabel(d['@type']) }}</span>
            <span class="badge text-[10px]" :class="normativeColor(d['gl:normativeStatus'])">{{ normativeStatus(d['gl:normativeStatus']) }}</span>
            <span v-if="d['gl:termType']" class="text-xs text-ink-300">{{ d['gl:termType'] }}</span>
            <template v-if="d['gl:grammarInfo']">
              <span v-for="(gi, giIdx) in d['gl:grammarInfo']" :key="giIdx" class="text-xs text-ink-300">
                <span v-if="gi['gl:gender']">{{ gi['gl:gender'] }}</span><span v-if="gi['gl:gender'] && gi['gl:number']">, </span><span v-if="gi['gl:number']">{{ gi['gl:number'] }}</span>
              </span>
            </template>
            <span v-if="d['gl:geographicalArea']" class="text-xs text-ink-300">{{ d['gl:geographicalArea'] }}</span>
          </div>
        </div>
      </div>

      <!-- Definition -->
      <div v-if="definition" class="card p-5">
        <div class="section-label">Definition</div>
        <div class="text-ink-800 leading-relaxed mt-3" v-html="renderMath(definition, renderOpts)"></div>
      </div>

      <!-- Notes -->
      <div v-if="notes.length" class="card p-5">
        <div class="section-label">Notes</div>
        <div class="space-y-3 mt-3">
          <div v-for="(note, i) in notes" :key="i" class="text-ink-600 text-sm leading-relaxed">
            <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">Note {{ i + 1 }}</span>
            <div class="mt-1" v-html="renderMath(note, renderOpts)"></div>
          </div>
        </div>
      </div>

      <!-- Examples -->
      <div v-if="examples.length" class="card p-5">
        <div class="section-label">Examples</div>
        <div class="space-y-3 mt-3">
          <div v-for="(ex, i) in examples" :key="i" class="text-ink-600 text-sm leading-relaxed">
            <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">Example {{ i + 1 }}</span>
            <div class="mt-1" v-html="renderMath(ex, renderOpts)"></div>
          </div>
        </div>
      </div>

      <!-- Sources -->
      <div v-if="sources.length" class="card p-5">
        <div class="section-label">Sources</div>
        <div class="space-y-3 mt-3">
          <div v-for="(src, i) in sources" :key="i" class="text-sm">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span v-if="src['gl:sourceType']" class="badge badge-blue text-[10px]">{{ src['gl:sourceType'] }}</span>
              <span v-if="src['gl:sourceStatus']" class="badge badge-gray text-[10px]">{{ src['gl:sourceStatus'] }}</span>
            </div>
            <div class="text-ink-700">
              <span v-if="src['gl:origin']?.['gl:ref']" class="font-medium">{{ src['gl:origin']['gl:ref'] }}</span>
              <span v-if="src['gl:origin']?.['gl:clause']">, {{ src['gl:origin']['gl:clause'] }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Term-only state -->
      <div v-if="isTermOnly" class="card p-5">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langLabel(activeLang) }}</span>
          </div>
          <div>
            <p class="text-sm text-ink-600 font-medium">Term only in {{ langName(activeLang) }}</p>
            <p class="text-xs text-ink-400 mt-1 leading-relaxed">
              This concept has a registered designation in {{ langName(activeLang) }} but no definition or notes.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- No data for this language -->
    <div v-else class="card p-5 text-center">
      <p class="text-sm text-ink-400">No data available for {{ langName(activeLang) }}.</p>
    </div>
  </div>
</template>
