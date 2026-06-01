<script setup lang="ts">
import { computed } from 'vue';
import { FORMAT_REGISTRY } from '../utils/concept-formats';
import { useI18n } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  registerId: string;
  conceptId: string;
  formats: string[];
}>();

interface FormatLink {
  key: string;
  label: string;
  url: string;
}

const links = computed<FormatLink[]>(() =>
  props.formats
    .filter(f => FORMAT_REGISTRY[f])
    .map(f => ({
      key: f,
      label: FORMAT_REGISTRY[f].label,
      url: `/data/${props.registerId}/concepts/${props.conceptId}.${FORMAT_REGISTRY[f].extension}`,
    })),
);
</script>

<template>
  <div v-if="links.length" class="space-y-2">
    <div class="section-label">{{ t('concept.downloads') }}</div>
    <div class="flex flex-wrap gap-2">
      <a
        v-for="link in links"
        :key="link.key"
        :href="link.url"
        :download="`${conceptId}.${FORMAT_REGISTRY[link.key].extension}`"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-ink-50 text-ink-600 hover:bg-ink-100 hover:text-ink-800 transition-colors border border-ink-100"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {{ link.label }}
      </a>
    </div>
  </div>
</template>
