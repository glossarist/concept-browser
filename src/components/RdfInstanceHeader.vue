<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  uri: string;
  conceptId: string;
}>();

defineEmits<{
  (e: 'copy', uri: string): void;
}>();

const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(props.uri);
  } catch {
    // clipboard may be unavailable; ignore
  }
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <div class="min-w-0">
    <div class="text-[10px] uppercase tracking-widest text-ink-300 font-medium mb-2">RDF Instance</div>
    <div class="flex items-center gap-2 flex-wrap">
      <code class="text-sm font-mono text-ink-700 break-all">{{ uri }}</code>
      <button
        type="button"
        @click="copy"
        class="p-1.5 rounded text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors flex-shrink-0"
        :title="copied ? 'Copied!' : 'Copy URI'"
        :aria-label="copied ? 'URI copied to clipboard' : 'Copy URI to clipboard'"
      >
        <svg v-if="!copied" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 01-2-2v-1m6 4v-3a2 2 0 00-2-2H8"/></svg>
        <svg v-else class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      </button>
    </div>
    <div class="flex gap-1.5 mt-2.5">
      <router-link to="/ontology/class/gloss-Concept" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">gloss:Concept</router-link>
      <router-link to="/ontology/class/gloss-Concept" class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors">skos:Concept</router-link>
    </div>
  </div>
</template>
