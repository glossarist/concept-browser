<script setup lang="ts">
import type { Designation, Expression, ConceptSource } from 'glossarist';
import { designationTypeInfo, normativeStatusInfo, abbreviationDetails, termTypeInfo, grammarBadges, pronunciationLabel, pronunciationTooltip, sourceTypeInfo } from '../utils/designation-registry';
import { relationshipLabel } from '../utils/relationship-categories';
import { langName } from '../utils/lang';
import { getDesignationTarget } from '../adapters/model-bridge';
import CitationDisplay from './CitationDisplay.vue';

const props = defineProps<{
  designations: Designation[];
  renderedDesignations: Map<string, string>;
  lang: string;
  registerId: string;
}>();

const emit = defineEmits<{
  (e: 'navigate-related', ref: { source: string | null; id: string | null }): void;
}>();

function resolvedLabel(dr: { content: string | null; ref?: { source: string | null; id: string | null } | null }): string {
  if (dr.content) return dr.content;
  if (dr.ref?.source && dr.ref?.id) return `${dr.ref.source}/${dr.ref.id}`;
  return '(ref)';
}
</script>

<template>
  <div v-if="designations.length > 0" class="space-y-1.5 pl-[22px]">
    <div v-for="(d, i) in designations" :key="i">
      <div class="flex items-center gap-1.5 text-sm flex-wrap">
        <span :class="d.normativeStatus === 'preferred' ? 'font-bold text-ink-800' : 'font-normal text-ink-700'" v-html="renderedDesignations.get(d.designation) ?? d.designation"></span>
        <span class="badge text-[10px] flex-shrink-0" :class="designationTypeInfo(d).color" :title="designationTypeInfo(d).definition ?? ''">{{ designationTypeInfo(d).label }}</span>
        <span class="badge text-[10px] flex-shrink-0" :class="normativeStatusInfo(d.normativeStatus).color" :title="normativeStatusInfo(d.normativeStatus).definition ?? ''">{{ normativeStatusInfo(d.normativeStatus).label }}</span>
        <template v-if="abbreviationDetails(d).length">
          <span v-for="abbr in abbreviationDetails(d)" :key="abbr" class="badge text-[10px] bg-amber-50 text-amber-600">{{ abbr }}</span>
        </template>
        <span v-if="d.termType" class="badge text-[10px] bg-gray-50 text-gray-600" :title="termTypeInfo(d.termType).definition ?? ''">{{ termTypeInfo(d.termType).label }}</span>
        <template v-if="d.type === 'expression' && (d as Expression).grammarInfo?.length">
          <template v-for="(gi, giIdx) in (d as Expression).grammarInfo" :key="giIdx">
            <span v-for="badge in grammarBadges(gi)" :key="giIdx + '-' + badge.label"
              class="badge text-[10px] bg-gray-50 text-gray-600" :title="badge.definition ?? ''">{{ badge.label }}</span>
          </template>
        </template>
        <template v-if="d.pronunciations?.length">
          <span v-for="(p, pi) in d.pronunciations" :key="'p'+pi"
            class="text-xs text-ink-400 font-mono" :title="pronunciationTooltip(p)">{{ pronunciationLabel(p) }}</span>
        </template>
        <span v-if="d.international" class="badge text-[10px] bg-sky-50 text-sky-600">international</span>
        <span v-if="d.absent" class="badge text-[10px] bg-red-50 text-red-600">absent</span>
        <span v-if="d.geographicalArea" class="badge text-[10px] bg-gray-50 text-gray-600">{{ d.geographicalArea }}</span>
        <span v-if="d.usageInfo" class="text-xs text-ink-300">{{ d.usageInfo }}</span>
        <span v-if="d.fieldOfApplication" class="text-xs text-ink-300">field: {{ d.fieldOfApplication }}</span>
        <template v-if="d.language && d.language !== lang">
          <span class="badge text-[10px] bg-teal-50 text-teal-600">lang: {{ langName(d.language) }}</span>
        </template>
        <span v-if="d.script" class="badge text-[10px] bg-gray-50 text-gray-600">script: {{ d.script }}</span>
        <span v-if="d.system" class="badge text-[10px] bg-gray-50 text-gray-600">system: {{ d.system }}</span>
      </div>
      <div v-if="d.sources?.length" class="mt-1 space-y-0.5">
        <div v-for="(ds, dsi) in d.sources" :key="'ds'+dsi" class="text-xs text-ink-400 flex items-center gap-1.5">
          <span v-if="ds.type" class="badge text-[9px]" :class="sourceTypeInfo(ds.type).color">{{ sourceTypeInfo(ds.type).label }}</span>
          <CitationDisplay v-if="ds.origin" :citation="ds.origin" :register-id="registerId" />
          <span v-else-if="ds.modification" class="text-ink-300">{{ ds.modification }}</span>
        </div>
      </div>
      <div v-if="d.related?.length" class="mt-0.5 space-y-0.5">
        <div v-for="(dr, dri) in d.related" :key="'dr'+dri" class="text-xs text-ink-400 flex items-center gap-1.5">
          <span class="badge text-[9px] bg-gray-50 text-gray-600">{{ relationshipLabel(dr.type ?? '') }}</span>
          <template v-if="getDesignationTarget(dr)">
            <span class="italic">{{ getDesignationTarget(dr) }}</span>
          </template>
          <button v-else-if="'ref' in dr && dr.ref" @click="emit('navigate-related', dr.ref)" class="concept-link">{{ resolvedLabel(dr) }}</button>
          <span v-else>{{ resolvedLabel(dr) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
