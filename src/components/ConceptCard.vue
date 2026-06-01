<script setup lang="ts">
import type { ConceptSummary } from '../adapters/types';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDsStyle } from '../utils/dataset-style';
import { useVocabularyStore } from '../stores/vocabulary';
import { useI18n } from '../i18n';

const props = defineProps<{
  entry: ConceptSummary;
  registerId: string;
  displayLang?: string | null;
}>();

const router = useRouter();
const { getColor } = useDsStyle();
const store = useVocabularyStore();
const { locale } = useI18n();

function viewConcept() {
  router.push({
    name: 'concept',
    params: { registerId: props.registerId, conceptId: props.entry.id },
  });
}

function statusColor(status: string): string {
  if (status === 'valid' || status === 'Standard') return 'bg-emerald-50 text-emerald-600';
  if (status === 'superseded') return 'bg-red-50 text-red-600';
  if (status === 'withdrawn') return 'bg-red-100 text-red-700';
  return 'bg-amber-50 text-amber-600';
}

const manifestLanguages = computed(() => store.manifests.get(props.registerId)?.languages ?? []);

const displayTitle = computed(() => {
  const lang = props.displayLang || locale.value;
  if (props.entry.designations?.[lang]) {
    return props.entry.designations[lang];
  }
  return props.entry.eng || props.entry.id;
});

const langCount = computed(() => {
  return Object.keys(props.entry.designations ?? {}).length;
});
</script>

<template>
  <button
    @click="viewConcept"
    class="card-hover p-4 text-left w-full border-l-2 group"
    :class="(entry.status === 'superseded' || entry.status === 'withdrawn') ? 'opacity-70' : ''"
    :style="{ borderLeftColor: getColor(registerId) }"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="font-medium text-ink-800 truncate group-hover:text-ink-900 transition-colors leading-snug text-[15px]">
          {{ displayTitle }}
        </h3>
        <p class="text-[11px] text-ink-300 mt-1 font-mono tabular-nums">{{ entry.id }}</p>
      </div>
      <span
        class="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
        :class="statusColor(entry.status)"
      >
        {{ entry.status === 'Standard' ? 'valid' : entry.status }}
      </span>
    </div>
    <!-- Language coverage -->
    <div class="flex items-center gap-1.5 mt-2.5">
      <span class="text-[11px] text-ink-300">{{ langCount }} lang</span>
      <div class="flex gap-0.5">
        <span
          v-for="lang in manifestLanguages"
          :key="lang"
          class="w-1.5 h-1.5 rounded-full"
          :style="{ backgroundColor: (lang in (entry.designations ?? {})) ? getColor(registerId) : getColor(registerId) + '20' }"
          :aria-label="lang"
        ></span>
      </div>
    </div>
  </button>
</template>
