<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import SearchBar from '../components/SearchBar.vue';
import { useUiStore } from '../stores/ui';
import { useI18n } from '../i18n';

const route = useRoute();
const ui = useUiStore();
const { t } = useI18n();

watch(() => [route.name, route.query.q], () => {
  ui.searchQuery = route.name === 'search' && typeof route.query.q === 'string'
    ? route.query.q.trim()
    : '';
}, { immediate: true });

onBeforeUnmount(() => {
  ui.searchQuery = '';
});
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">{{ t('nav.home') }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ t('nav.search') }}</span>
    </nav>
    <SearchBar />
  </div>
</template>
