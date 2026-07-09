<template>
  <section v-if="entries.length" class="bibliography-island">
    <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-3">Bibliography</h2>
    <ul class="space-y-1">
      <li v-for="entry in entries" :key="entry.id" class="text-sm flex items-start gap-2">
        <span class="text-ink-400 font-mono text-xs shrink-0">[{{ entry.id }}]</span>
        <div>
          <span class="text-ink-600 dark:text-ink-300">{{ entry.reference }}</span>
          <a v-if="entry.link" :href="entry.link" target="_blank" class="text-blue-600 hover:underline text-xs ml-2">↗</a>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  entries: Array<{
    id: string;
    reference: string;
    title?: string;
    link?: string;
    type?: string;
  }>;
}>();
</script>
