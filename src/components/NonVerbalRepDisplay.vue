<script setup lang="ts">
import type { NonVerbRep, ConceptSource } from 'glossarist';
import { sourceStatusInfo, sourceTypeInfo } from '../utils/designation-registry';

defineProps<{
  reps: NonVerbRep[];
}>();
</script>

<template>
  <div v-if="reps.length" class="space-y-3">
    <div class="section-label">Non-verbal representations</div>
    <div v-for="(rep, i) in reps" :key="i" class="card p-4 space-y-2">
      <div class="flex items-center gap-2">
        <span class="badge text-[10px] bg-violet-50 text-violet-700">{{ rep.type ?? 'representation' }}</span>
        <span v-if="rep.text" class="text-sm text-ink-700">{{ rep.text }}</span>
      </div>

      <!-- Image -->
      <div v-if="rep.type === 'image' && rep.ref">
        <img :src="rep.ref" :alt="rep.text || 'Non-verbal representation'" class="max-h-64 rounded border border-ink-100" loading="lazy" />
      </div>

      <!-- Table / Formula reference -->
      <div v-if="(rep.type === 'table' || rep.type === 'formula') && rep.ref">
        <a :href="rep.ref" target="_blank" rel="noopener" class="text-sm concept-link break-all">{{ rep.ref }}</a>
      </div>

      <!-- Sources for this representation -->
      <div v-if="rep.sources?.length" class="flex flex-wrap gap-1.5">
        <div v-for="(src, si) in rep.sources" :key="si" class="text-xs text-ink-400">
          <span v-if="src.type" class="badge text-[9px]" :class="sourceTypeInfo(src.type).color">{{ sourceTypeInfo(src.type).label }}</span>
          <span v-if="src.origin?.ref" class="ml-1">{{ src.origin.ref.source }}{{ src.origin.ref.id ? ' ' + src.origin.ref.id : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
