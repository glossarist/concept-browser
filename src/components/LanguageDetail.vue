<script setup lang="ts">
import type { Concept, LocalizedConcept, Designation, Expression, Abbreviation as AbbreviationType } from 'glossarist';
import { computed } from 'vue';
import { langName, langLabel } from '../utils/lang';
import { renderContent } from '../utils/content-renderer';
import type { RenderOptions } from '../utils/content-renderer';
import { escapeAttr } from '../utils/escape';
import { entryStatusColor } from '../utils/concept-helpers';
import { designationTypeInfo, normativeStatusInfo, grammarBadges, pronunciationLabel, pronunciationTooltip } from '../utils/designation-registry';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';
import CitationDisplay from './CitationDisplay.vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  concept: Concept;
  activeLang: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeLang', lang: string): void;
}>();

const lc = computed(() => props.concept.localization(props.activeLang));
const availableLangs = computed(() => [...props.concept.languages].sort());

const designations = computed(() => lc.value?.terms ?? []);
const definition = computed(() => {
  if (!lc.value) return '';
  const content = lc.value.definitions.map(d => d.content).filter(Boolean).join('\n\n');
  return content;
});
const notes = computed(() => lc.value?.notes.map(n => n.content).filter(Boolean) ?? []);
const examples = computed(() => lc.value?.examples.map(e => e.content).filter(Boolean) ?? []);
const sources = computed(() => lc.value?.sources ?? []);

const hasContent = computed(() =>
  definition.value || notes.value.length > 0 || examples.value.length > 0 || designations.value.length > 1
);

function abbrevInfo(d: Designation): { acronym: boolean; initialism: boolean; truncation: boolean } | null {
  if (d.type !== 'abbreviation') return null;
  const a = d as AbbreviationType;
  return { acronym: !!a.acronym, initialism: !!a.initialism, truncation: !!a.truncation };
}

const isTermOnly = computed(() =>
  !definition.value && notes.value.length === 0 && examples.value.length === 0
);

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
      <div v-if="lc.entryStatus" class="flex items-center gap-2 mb-4">
        <span class="badge" :class="entryStatusColor(lc.entryStatus)">{{ lc.entryStatus }}</span>
      </div>

      <!-- Designations -->
      <div v-if="designations.length > 0" class="card p-5">
        <div class="section-label">{{ t('concept.designations') }}</div>
        <div class="space-y-2 mt-3">
          <div v-for="(d, i) in designations" :key="i" class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-ink-800 text-lg" v-html="renderContent(d.designation)"></span>
            <span class="badge text-[10px]" :class="designationTypeInfo(d).color">{{ designationTypeInfo(d).label }}</span>
            <span class="badge text-[10px]" :class="normativeStatusInfo(d.normativeStatus).color">{{ normativeStatusInfo(d.normativeStatus).label }}</span>
            <template v-if="d.type === 'expression' && (d as Expression).grammarInfo?.length">
              <template v-for="(gi, giIdx) in (d as Expression).grammarInfo" :key="giIdx">
                <span v-for="badge in grammarBadges(gi)" :key="giIdx + '-' + badge.label"
                  class="badge text-[10px] bg-gray-50 text-gray-600">{{ badge.label }}</span>
              </template>
            </template>
            <template v-if="abbrevInfo(d)" v-for="(val, key) in abbrevInfo(d)" :key="key">
              <span v-if="val" class="badge text-[10px] bg-amber-50 text-amber-600">{{ key }}</span>
            </template>
            <span v-if="d.geographicalArea" class="badge text-[10px] bg-gray-50 text-gray-600">{{ d.geographicalArea }}</span>
            <span v-if="d.international" class="badge text-[10px] bg-sky-50 text-sky-600">international</span>
            <span v-if="d.absent" class="badge text-[10px] bg-red-50 text-red-600">absent</span>
            <span v-if="d.usageInfo" class="text-xs text-ink-300">{{ d.usageInfo }}</span>
            <template v-if="d.pronunciations?.length">
              <span v-for="(p, pi) in d.pronunciations" :key="'p'+pi"
                class="text-xs text-ink-400 font-mono" :title="pronunciationTooltip(p)">{{ pronunciationLabel(p) }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Definition -->
      <div v-if="definition" class="card p-5">
        <div class="section-label">{{ t('concept.definition') }}</div>
        <div class="text-ink-800 leading-relaxed mt-3" v-html="renderContent(definition, renderOpts)"></div>
      </div>

      <!-- Notes -->
      <div v-if="notes.length" class="card p-5">
        <div class="section-label">{{ t('concept.notes') }}</div>
        <div class="space-y-3 mt-3">
          <div v-for="(note, i) in notes" :key="i" class="text-ink-600 text-sm leading-relaxed">
            <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">{{ t('concept.note') }} {{ i + 1 }}</span>
            <div class="mt-1" v-html="renderContent(note, renderOpts)"></div>
          </div>
        </div>
      </div>

      <!-- Examples -->
      <div v-if="examples.length" class="card p-5">
        <div class="section-label">{{ t('concept.examples') }}</div>
        <div class="space-y-3 mt-3">
          <div v-for="(ex, i) in examples" :key="i" class="text-ink-600 text-sm leading-relaxed">
            <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">{{ t('concept.example') }} {{ i + 1 }}</span>
            <div class="mt-1" v-html="renderContent(ex, renderOpts)"></div>
          </div>
        </div>
      </div>

      <!-- Sources -->
      <div v-if="sources.length" class="card p-5">
        <div class="section-label">Sources</div>
        <div class="space-y-3 mt-3">
          <div v-for="(src, i) in sources" :key="i" class="text-sm">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span v-if="src.type" class="badge badge-blue text-[10px]">{{ src.type }}</span>
              <span v-if="src.status" class="badge badge-gray text-[10px]">{{ src.status }}</span>
            </div>
            <div class="text-ink-700">
              <CitationDisplay v-if="src.origin" :citation="src.origin" />
            </div>
            <div v-if="src.sourced_from?.length" class="text-xs text-ink-400 mt-1">
              <span class="text-ink-300">{{ t('concept.sourcedFrom') }}:</span>
              <div v-for="(sf, sfi) in src.sourced_from" :key="'sf'+sfi" class="ml-2">
                <CitationDisplay v-if="sf" :citation="sf" />
              </div>
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
            <p class="text-sm text-ink-600 font-medium">{{ t('lang.termOnlyIn') }} {{ langName(activeLang) }}</p>
            <p class="text-xs text-ink-400 mt-1 leading-relaxed">
              This concept has a registered designation in {{ langName(activeLang) }} but no definition or notes.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- No data for this language -->
    <div v-else class="card p-5 text-center">
      <p class="text-sm text-ink-400">{{ t('concept.noData') }}</p>
    </div>
  </div>
</template>
