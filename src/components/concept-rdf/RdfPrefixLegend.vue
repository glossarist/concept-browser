<script setup lang="ts">
import { computed } from 'vue';
import { RDF_PREFIXES } from './rdf-prefixes';

const props = defineProps<{
  collapsed?: boolean;
}>();

const rows = computed(() => RDF_PREFIXES);
</script>

<template>
  <details :open="!collapsed" class="card px-4 py-2 text-[11px]">
    <summary class="cursor-pointer text-ink-500 select-none hover:text-ink-700">
      Prefixes <span class="text-ink-300">({{ rows.length }})</span>
    </summary>
    <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      <template v-for="p in rows" :key="p.prefix">
        <dt><code class="text-blue-600">{{ p.prefix }}:</code></dt>
        <dd>
          <code class="text-ink-500">{{ p.iri }}</code>
          <span class="text-ink-300 ml-2">{{ p.description }}</span>
        </dd>
      </template>
    </dl>
  </details>
</template>
