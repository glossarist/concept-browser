<template>
  <div class="nvr-island">
    <section v-if="figures.length" class="mb-6">
      <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-3">Figures</h2>
      <div class="space-y-4">
        <figure v-for="(fig, i) in figures" :key="i" class="card p-4">
          <figcaption class="text-sm text-ink-600 dark:text-ink-300 mb-2" dir="auto">{{ fig.caption || `Figure ${i + 1}` }}</figcaption>
          <div v-if="fig.images?.length" class="grid grid-cols-2 gap-2">
            <img
              v-for="(img, j) in fig.images"
              :key="j"
              :src="`/data/${registerId}/images/${img.src}`"
              :alt="fig.altText || fig.caption || `Figure ${i + 1}`"
              class="rounded border border-ink-200 dark:border-ink-700 max-w-full"
              loading="lazy"
            />
          </div>
          <p v-if="fig.description" class="text-xs text-ink-400 mt-2" dir="auto">{{ fig.description }}</p>
        </figure>
      </div>
    </section>

    <section v-if="tables.length" class="mb-6">
      <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-3">Tables</h2>
      <div class="space-y-4">
        <div v-for="(tbl, i) in tables" :key="i" class="card p-4">
          <p class="text-sm text-ink-600 dark:text-ink-300 mb-2" dir="auto">{{ tbl.caption || `Table ${i + 1}` }}</p>
          <div v-if="tbl.rows?.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <tbody>
                <tr v-for="(row, r) in tbl.rows" :key="r" class="border-b border-ink-100 dark:border-ink-700">
                  <td v-for="(cell, c) in row" :key="c" class="py-1 px-2 text-ink-600 dark:text-ink-300" dir="auto">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section v-if="formulas.length" class="mb-6">
      <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-3">Formulas</h2>
      <div class="space-y-3">
        <div v-for="(fml, i) in formulas" :key="i" class="card p-4">
          <p v-if="fml.caption" class="text-sm text-ink-600 dark:text-ink-300 mb-2" dir="auto">{{ fml.caption }}</p>
          <code class="text-sm font-mono text-ink-700 dark:text-ink-200 bg-ink-50 dark:bg-ink-800 px-2 py-1 rounded" dir="auto">{{ fml.content || fml.latex || fml.text || '' }}</code>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  nonVerbalReps?: Array<{
    type?: string;
    caption?: string;
    description?: string;
    images?: Array<{ src: string }>;
    altText?: string;
    rows?: string[][];
    content?: string;
    latex?: string;
    text?: string;
  }>;
  registerId: string;
}>();

const all = computed(() => props.nonVerbalReps || []);
const figures = computed(() => all.value.filter(r => r.type === 'figure'));
const tables = computed(() => all.value.filter(r => r.type === 'table'));
const formulas = computed(() => all.value.filter(r => r.type === 'formula'));
</script>
