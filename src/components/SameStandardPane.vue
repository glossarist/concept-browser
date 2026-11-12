<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { RouterLink } from 'vue-router';
import type { SameStandardTerms } from '../composables/use-same-standard-terms';
import { useI18n } from '../i18n';

const props = defineProps<{
  groups: SameStandardTerms[];
  registerId: string;
  conceptId: string;
}>();

const { t } = useI18n();
const contentId = `same-standard-terms-${useId()}`;
const storageKey = 'same-standard-pane-collapsed';
const visibleGroups = computed(() => props.groups
  .map(group => ({ ...group, terms: group.terms.filter(term => term.conceptId !== props.conceptId) }))
  .filter(group => group.terms.length > 0));

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

const collapsed = ref(readCollapsed());

function toggle() {
  collapsed.value = !collapsed.value;
  try {
    localStorage.setItem(storageKey, String(collapsed.value));
  } catch {
    // Browsing remains available when storage is disabled or full.
  }
}
</script>

<template>
  <aside v-if="visibleGroups.length" class="same-standard-pane rounded-lg border border-gray-200 dark:border-gray-700">
    <h2>
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-semibold text-gray-800 dark:text-gray-200"
        :aria-expanded="!collapsed"
        :aria-controls="contentId"
        @click="toggle"
      >
        {{ t('concept.sameStandardTerms') }}
        <span aria-hidden="true">{{ collapsed ? '+' : '−' }}</span>
      </button>
    </h2>
    <div :id="contentId" :hidden="collapsed" class="space-y-4 border-t border-gray-200 p-4 dark:border-gray-700">
      <section v-for="group in visibleGroups" :key="group.key">
        <h3 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ group.label }} <span class="text-gray-500">({{ group.terms.length }})</span>
        </h3>
        <ul class="space-y-2 text-sm">
          <li v-for="term in group.terms" :key="term.conceptId">
            <RouterLink
              :to="{ name: 'concept', params: { registerId, conceptId: term.conceptId } }"
              class="break-words text-blue-600 hover:underline dark:text-blue-400"
            >{{ term.designation }}</RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>
