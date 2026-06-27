<script setup lang="ts">
import type { PropValue } from './use-rdf-document';

defineProps<{
  section: {
    classId: string;
    classLabel: string;
    label: string;
    props: PropValue[];
  };
}>();

function accent(classId: string): string {
  if (classId === 'gloss:Concept') return 'bg-blue-500';
  if (classId === 'gloss:LocalizedConcept') return 'bg-emerald-500';
  return 'bg-amber-500';
}

function classRoute(classId: string): string {
  return `/ontology/class/${classId.replace(/:/g, '-')}`;
}
</script>

<template>
  <div class="card p-5">
    <div class="flex items-center gap-2 mb-3">
      <div class="w-1 h-4 rounded-full" :class="accent(section.classId)"></div>
      <router-link :to="classRoute(section.classId)" class="text-xs font-semibold text-ink-700 hover:text-blue-600 transition-colors">{{ section.classId }}</router-link>
      <span class="text-xs text-ink-400">·</span>
      <span class="text-xs text-ink-500">{{ section.label }}</span>
    </div>
    <div class="space-y-1.5">
      <div
        v-for="prop in section.props"
        :key="prop.predicate"
        class="grid grid-cols-[160px_1fr] gap-x-3 gap-y-0.5 py-1.5 border-b border-ink-100/30 last:border-0"
      >
        <code class="text-xs text-blue-600 font-medium leading-relaxed self-start pt-0.5">{{ prop.predicate }}</code>
        <div class="flex flex-col gap-0.5">
          <template v-for="(val, vi) in prop.values" :key="vi">
            <span
              v-if="prop.nested"
              class="text-xs text-ink-600 bg-ink-50/60 px-2 py-1 rounded border-l-2 border-ink-200 leading-relaxed break-words"
            >{{ val }}</span>
            <span
              v-else
              class="text-xs text-ink-600 leading-relaxed break-words"
            >{{ val }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
