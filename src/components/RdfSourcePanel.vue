<script setup lang="ts">
import { ref, computed } from 'vue';
import { RDF_PREFIXES } from './rdf-prefixes';

const props = defineProps<{
  turtle: string;
  jsonld: string;
  resourceCount: number;
  defaultFormat?: 'turtle' | 'jsonld';
}>();

const emit = defineEmits<{
  (e: 'format-change', format: 'turtle' | 'jsonld'): void;
}>();

const showSource = ref(false);
const format = ref<'turtle' | 'jsonld'>(props.defaultFormat ?? 'turtle');

const text = computed(() => format.value === 'turtle' ? props.turtle : props.jsonld);

function togglePanel() {
  showSource.value = !showSource.value;
}

function pickFormat(next: 'turtle' | 'jsonld') {
  format.value = next;
  emit('format-change', next);
}
</script>

<template>
  <div class="card overflow-hidden">
    <button
      type="button"
      class="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-ink-50/30 transition-colors"
      :aria-expanded="showSource"
      @click="togglePanel"
    >
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-ink-400 transition-transform" :class="showSource ? 'rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        <span class="text-sm font-medium text-ink-700">RDF Source</span>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="format"
          class="text-xs border border-ink-200 rounded px-2 py-1 bg-surface text-ink-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          @click.stop
          @change="pickFormat(format)"
        >
          <option value="turtle">Turtle</option>
          <option value="jsonld">JSON-LD</option>
        </select>
        <span class="text-[10px] text-ink-300">{{ resourceCount }} resources</span>
      </div>
    </button>
    <div v-if="showSource" class="border-t border-ink-100/60">
      <pre
        dir="auto"
        class="p-4 text-xs font-mono text-ink-700 bg-ink-50/30 overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto"
      >{{ text }}</pre>
      <details class="border-t border-ink-100/60 px-4 py-2 bg-surface/50">
        <summary class="text-[11px] text-ink-400 cursor-pointer hover:text-ink-600 select-none">Prefixes ({{ RDF_PREFIXES.length }})</summary>
        <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
          <template v-for="p in RDF_PREFIXES" :key="p.prefix">
            <dt><code class="text-blue-600">{{ p.prefix }}:</code></dt>
            <dd class="text-ink-400">{{ p.iri }}</dd>
          </template>
        </dl>
      </details>
    </div>
  </div>
</template>
