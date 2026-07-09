<template>
  <div class="concept-island">
    <!-- View mode toggle -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <button
          @click="viewMode = 'detail'"
          :class="['px-3 py-1 text-sm rounded transition-colors', viewMode === 'detail' ? 'bg-blue-500 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800']"
        >Detail</button>
        <button
          @click="viewMode = 'sphere'"
          :class="['px-3 py-1 text-sm rounded transition-colors', viewMode === 'sphere' ? 'bg-blue-500 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800']"
        >Sphere</button>
      </div>
      <button
        @click="rdfOpen = !rdfOpen"
        class="px-3 py-1 text-sm rounded text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
      >RDF Source {{ rdfOpen ? '▾' : '▸' }}</button>
    </div>

    <!-- Detail view -->
    <div v-if="viewMode === 'detail'" class="space-y-6">
      <!-- Designations -->
      <section v-if="designations.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Terms</h2>
        <ul class="space-y-1">
          <li v-for="d in designations" :key="d.text" class="flex items-baseline gap-2">
            <span
              :class="['text-xs px-1.5 py-0.5 rounded font-medium', d.badge]"
            >{{ d.status }}</span>
            <span class="text-ink-700 dark:text-ink-200" dir="auto">{{ d.text }}</span>
          </li>
        </ul>
      </section>

      <!-- Definition -->
      <section v-if="concept.definition?.eng">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Definition</h2>
        <p class="text-ink-700 dark:text-ink-200 leading-relaxed" dir="auto">{{ concept.definition.eng }}</p>
      </section>

      <!-- Notes -->
      <section v-if="notes.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Notes</h2>
        <ul class="space-y-2">
          <li v-for="(note, i) in notes" :key="i" class="text-sm text-ink-600 dark:text-ink-300 pl-4 border-l-2 border-ink-200 dark:border-ink-700" dir="auto">{{ note }}</li>
        </ul>
      </section>

      <!-- Examples -->
      <section v-if="examples.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Examples</h2>
        <ul class="space-y-2">
          <li v-for="(ex, i) in examples" :key="i" class="text-sm text-ink-600 dark:text-ink-300 pl-4 border-l-2 border-emerald-200 dark:border-emerald-700" dir="auto">Example {{ i + 1 }}: {{ ex }}</li>
        </ul>
      </section>

      <!-- Sources -->
      <section v-if="sources.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Sources</h2>
        <ul class="space-y-1 text-sm text-ink-500">
          <li v-for="(src, i) in sources" :key="i">
            <span v-if="src.ref" class="font-medium">{{ src.ref.source }} {{ src.ref.id }}</span>
            <span v-if="src.link"> · <a :href="src.link" class="text-blue-600 hover:underline" target="_blank">link</a></span>
          </li>
        </ul>
      </section>

      <!-- Relationships -->
      <section v-if="relationships.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Relationships</h2>
        <ul class="space-y-1">
          <li v-for="rel in relationships" :key="rel.type + rel.target" class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium">{{ rel.type }}</span>
            <a :href="`/resolve/${rel.target}`" class="text-sm text-blue-600 hover:underline">{{ rel.target }}</a>
          </li>
        </ul>
      </section>

      <!-- Groups / Sections -->
      <section v-if="concept.groups?.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Sections</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="g in concept.groups" :key="g" class="text-xs px-2 py-1 rounded bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300">{{ g }}</span>
        </div>
      </section>
    </div>

    <!-- Sphere view placeholder (loads D3 island dynamically) -->
    <div v-else class="border border-ink-200 dark:border-ink-700 rounded-lg p-8 text-center">
      <div class="inline-block w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
      <p class="text-ink-400">Loading 3D sphere visualization...</p>
      <p class="text-xs text-ink-300 mt-2">D3 force simulation initializing</p>
    </div>

    <!-- RDF panel -->
    <div v-if="rdfOpen" class="mt-6 card overflow-hidden">
      <div class="bg-ink-50/50 dark:bg-ink-800/30 px-4 py-2 border-b border-ink-100/60 dark:border-ink-700/40">
        <span class="text-sm font-medium text-ink-600 dark:text-ink-300">RDF Source</span>
      </div>
      <pre class="p-4 text-xs font-mono text-ink-600 dark:text-ink-300 overflow-x-auto max-h-96 overflow-y-auto" dir="auto">{{ turtleSource }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  concept: {
    conceptId: string;
    designations: Record<string, string>;
    definition?: Record<string, string>;
    groups?: string[];
    status?: string;
    uri: string;
    notes?: Record<string, string[]>;
    examples?: Record<string, string[]>;
    sources?: any[];
    related?: Array<{ type: string; target: string }>;
  };
  registerId: string;
  turtleSource?: string;
}>();

const viewMode = ref<'detail' | 'sphere'>('detail');
const rdfOpen = ref(false);

const designations = computed(() => {
  const entries: Array<{ text: string; status: string; badge: string }> = [];
  for (const [lang, text] of Object.entries(props.concept.designations || {})) {
    entries.push({
      text,
      status: 'preferred',
      badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    });
  }
  return entries;
});

const notes = computed(() => props.concept.notes?.eng ?? []);
const examples = computed(() => props.concept.examples?.eng ?? []);
const sources = computed(() => props.concept.sources ?? []);
const relationships = computed(() => props.concept.related ?? []);

const turtleSource = computed(() => {
  return props.turtleSource || `# RDF not pre-computed for this concept\n# URI: ${props.concept.uri}`;
});
</script>
