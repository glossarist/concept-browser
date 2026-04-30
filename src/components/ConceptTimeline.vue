<script setup lang="ts">
import type { LocalizedConcept } from '../adapters/types';
import { computed } from 'vue';
import { langName, langLabel } from '../utils/lang';

const props = defineProps<{
  localizedConcepts: Record<string, LocalizedConcept>;
  activeLang: string;
  languageOrder?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:activeLang', lang: string): void;
}>();

interface TimelineEntry {
  date: string;
  dateShort: string;
  year: string;
  eventType: string;
  description: string;
  lang: string;
}

const currentLc = computed(() => props.localizedConcepts[props.activeLang]);

// Build timeline entries from the localized concept review/history fields
const timelineEntries = computed((): TimelineEntry[] => {
  const lc = currentLc.value;
  if (!lc) return [];

  const entries: TimelineEntry[] = [];

  // gl:dates array — most structured source
  if (lc['gl:dates']?.length) {
    for (const d of lc['gl:dates']) {
      const dateType = d['gl:dateType'] || 'unknown';
      const dateStr = d['gl:date'] || '';
      entries.push({
        date: dateStr,
        dateShort: formatDate(dateStr),
        year: extractYear(dateStr),
        eventType: dateType,
        description: dateTypeLabel(dateType),
        lang: props.activeLang,
      });
    }
  }

  // Review date
  if (lc['gl:reviewDate']) {
    if (!entries.some(e => e.date === lc['gl:reviewDate'])) {
      entries.push({
        date: lc['gl:reviewDate'],
        dateShort: formatDate(lc['gl:reviewDate']),
        year: extractYear(lc['gl:reviewDate']),
        eventType: 'review',
        description: 'Review initiated',
        lang: props.activeLang,
      });
    }
  }

  // Review decision date
  if (lc['gl:reviewDecisionDate']) {
    if (!entries.some(e => e.date === lc['gl:reviewDecisionDate'] && e.eventType !== 'review')) {
      entries.push({
        date: lc['gl:reviewDecisionDate'],
        dateShort: formatDate(lc['gl:reviewDecisionDate']),
        year: extractYear(lc['gl:reviewDecisionDate']),
        eventType: 'decision',
        description: lc['gl:reviewDecisionEvent'] || 'Review decision',
        lang: props.activeLang,
      });
    }
  }

  // Sort by date ascending
  entries.sort((a, b) => a.date.localeCompare(b.date));

  return entries;
});

const hasHistory = computed(() => timelineEntries.value.length > 0);

// Group entries by year for long timelines
const groupedByYear = computed(() => {
  const entries = timelineEntries.value;
  if (entries.length <= 3) return null;

  const groups: { year: string; entries: TimelineEntry[] }[] = [];
  let currentYear = '';
  for (const entry of entries) {
    if (entry.year !== currentYear) {
      currentYear = entry.year;
      groups.push({ year: currentYear, entries: [entry] });
    } else {
      groups[groups.length - 1].entries.push(entry);
    }
  }
  return groups;
});

// Review metadata (decision, status, notes)
const reviewMeta = computed(() => {
  const lc = currentLc.value;
  if (!lc) return null;
  const fields: { key: string; label: string; value: string }[] = [];
  if (lc['gl:reviewStatus']) fields.push({ key: 'status', label: 'Review Status', value: lc['gl:reviewStatus'] });
  if (lc['gl:reviewDecision']) fields.push({ key: 'decision', label: 'Decision', value: lc['gl:reviewDecision'] });
  if (lc['gl:reviewDecisionNotes']) fields.push({ key: 'notes', label: 'Change Notes', value: lc['gl:reviewDecisionNotes'] });
  if (lc['gl:entryStatus']) fields.push({ key: 'entry', label: 'Entry Status', value: lc['gl:entryStatus'] });
  if (lc['gl:release'] != null) fields.push({ key: 'release', label: 'Release', value: String(lc['gl:release']) });
  return fields.length ? fields : null;
});

// Review event (for prominent display)
const reviewEvent = computed(() => {
  const lc = currentLc.value;
  if (!lc) return null;
  return lc['gl:reviewDecisionEvent'] || null;
});

// Which languages have any history data
const languagesWithHistory = computed(() => {
  const langs: string[] = [];
  for (const [lang, lc] of Object.entries(props.localizedConcepts)) {
    if (
      lc['gl:dates']?.length ||
      lc['gl:reviewDate'] ||
      lc['gl:reviewDecisionDate'] ||
      lc['gl:reviewDecisionEvent'] ||
      lc['gl:reviewDecisionNotes']
    ) {
      langs.push(lang);
    }
  }
  const order = props.languageOrder;
  if (order) {
    const orderIndex = new Map(order.map((l, i) => [l, i]));
    langs.sort((a, b) => {
      const ai = orderIndex.get(a) ?? order.length;
      const bi = orderIndex.get(b) ?? order.length;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
  } else {
    langs.sort();
  }
  return langs;
});

function formatDate(isoDate: string): string {
  if (!isoDate) return '\u2014';
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoDate.slice(0, 10);
  }
}

function extractYear(isoDate: string): string {
  if (!isoDate) return '';
  return isoDate.slice(0, 4);
}

function dateTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    accepted: 'Concept accepted',
    amended: 'Definition amended',
    superseded: 'Concept superseded',
    withdrawn: 'Concept withdrawn',
    published: 'Published',
    review: 'Under review',
  };
  return labels[type] || type;
}

function eventColor(type: string): string {
  const colors: Record<string, string> = {
    accepted: 'bg-emerald-100 text-emerald-700',
    amended: 'bg-amber-100 text-amber-700',
    superseded: 'bg-red-100 text-red-700',
    withdrawn: 'bg-red-100 text-red-700',
    published: 'bg-blue-100 text-blue-700',
    decision: 'bg-purple-100 text-purple-700',
    review: 'bg-ink-100 text-ink-600',
  };
  return colors[type] || 'bg-ink-50 text-ink-500';
}

function eventDotColor(type: string): string {
  const colors: Record<string, string> = {
    accepted: 'bg-emerald-500',
    amended: 'bg-amber-500',
    superseded: 'bg-red-500',
    withdrawn: 'bg-red-500',
    published: 'bg-blue-500',
    decision: 'bg-purple-500',
    review: 'bg-ink-400',
  };
  return colors[type] || 'bg-ink-200';
}

function eventRingColor(type: string): string {
  const colors: Record<string, string> = {
    accepted: 'ring-emerald-200',
    amended: 'ring-amber-200',
    superseded: 'ring-red-200',
    withdrawn: 'ring-red-200',
    published: 'ring-blue-200',
    decision: 'ring-purple-200',
    review: 'ring-ink-100',
  };
  return colors[type] || 'ring-ink-100';
}

function entryStatusColor(status: string): string {
  if (status === 'valid' || status === 'Standard') return 'badge-green';
  if (status === 'superseded') return 'bg-red-50 text-red-700';
  if (status === 'withdrawn') return 'bg-red-100 text-red-800';
  if (status === 'draft') return 'badge-yellow';
  return 'badge-gray';
}

function eventIconPath(type: string): string {
  // Returns an SVG path for the event type icon
  switch (type) {
    case 'accepted':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'; // circle check
    case 'amended':
      return 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'; // pencil edit
    case 'superseded':
    case 'withdrawn':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'; // warning
    case 'decision':
      return 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'; // badge check
    case 'review':
      return 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'; // search
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'; // info
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Language selector for history -->
    <div v-if="languagesWithHistory.length > 1" class="flex flex-wrap gap-1.5">
      <button
        v-for="lang in languagesWithHistory"
        :key="lang"
        @click="emit('update:activeLang', lang)"
        :class="[
          activeLang === lang
            ? 'bg-ink-800 text-white'
            : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'
        ]"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
      >
        <span
          class="text-xs font-semibold px-1.5 py-0.5 rounded"
          :class="activeLang === lang ? 'bg-ink-700 text-ink-200' : 'bg-ink-50 text-ink-500'"
        >{{ langLabel(lang) }}</span>
        {{ langName(lang) }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="!hasHistory && !reviewMeta" class="card p-6 text-center">
      <div class="text-ink-200 text-4xl font-serif mb-2">&empty;</div>
      <p class="text-sm text-ink-400">No history data available for {{ langName(activeLang) }}.</p>
    </div>

    <!-- Review event banner (prominent) -->
    <div
      v-if="reviewEvent && hasHistory"
      class="card p-4 flex items-start gap-3 border-l-2"
      :class="[
        currentLc?.['gl:entryStatus'] === 'superseded' ? 'border-l-red-400' : 'border-l-purple-400'
      ]"
    >
      <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        :class="eventColor('decision')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :d="eventIconPath('decision')" />
        </svg>
      </div>
      <div class="min-w-0">
        <div class="text-sm font-medium text-ink-800">{{ reviewEvent }}</div>
        <div v-if="currentLc?.['gl:reviewDecisionDate']" class="text-xs text-ink-300 mt-0.5">
          {{ formatDate(currentLc['gl:reviewDecisionDate']) }}
        </div>
      </div>
    </div>

    <!-- Timeline: Grouped by year (for >3 entries) -->
    <div v-if="hasHistory && groupedByYear" class="relative pl-10">
      <!-- Vertical line -->
      <div class="absolute left-[17px] top-3 bottom-3 w-px bg-ink-100/80"></div>

      <div class="space-y-6">
        <div v-for="(group, gi) in groupedByYear" :key="group.year">
          <!-- Year marker -->
          <div class="relative -ml-10 flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-full bg-surface-raised border border-ink-200/60 flex items-center justify-center relative z-10"
              style="box-shadow: 0 0 0 3px var(--surface-color, #faf9f6);"
            >
              <span class="text-[11px] font-semibold text-ink-500 font-mono">{{ group.year }}</span>
            </div>
            <div class="h-px flex-1 bg-ink-100/60"></div>
          </div>

          <!-- Events in this year -->
          <div class="space-y-3 ml-0">
            <div
              v-for="(entry, i) in group.entries"
              :key="gi + '-' + i"
              class="relative group"
              :style="{ animationDelay: `${(gi * 2 + i) * 60}ms` }"
            >
              <!-- Node dot -->
              <div class="absolute -left-[29px] top-3.5 w-[11px] h-[11px] rounded-full ring-[3px] z-10"
                :class="[eventDotColor(entry.eventType), eventRingColor(entry.eventType)]"
                style="box-shadow: 0 0 0 2px var(--surface-color, #faf9f6);"
              ></div>

              <!-- Content -->
              <div class="card p-3.5 ml-1">
                <div class="flex items-center gap-2 mb-1">
                  <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    :class="eventColor(entry.eventType)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" :d="eventIconPath(entry.eventType)" />
                    </svg>
                  </div>
                  <span class="text-[10px] font-semibold uppercase tracking-wider" :class="eventColor(entry.eventType)">
                    {{ entry.eventType }}
                  </span>
                  <span class="text-[11px] text-ink-300 ml-auto tabular-nums">{{ entry.dateShort }}</span>
                </div>
                <p class="text-sm text-ink-700 font-medium leading-snug">{{ entry.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Timeline: Simple (for <=3 entries) -->
    <div v-if="hasHistory && !groupedByYear" class="relative pl-10">
      <!-- Vertical line -->
      <div class="absolute left-[17px] top-3 bottom-3 w-px bg-ink-100/80"></div>

      <div class="space-y-4">
        <div
          v-for="(entry, i) in timelineEntries"
          :key="i"
          class="relative"
        >
          <!-- Node dot -->
          <div class="absolute -left-[29px] top-3.5 w-[11px] h-[11px] rounded-full ring-[3px] z-10"
            :class="[eventDotColor(entry.eventType), eventRingColor(entry.eventType)]"
            style="box-shadow: 0 0 0 2px var(--surface-color, #faf9f6);"
          ></div>

          <!-- Content -->
          <div class="card p-3.5 ml-1">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                :class="eventColor(entry.eventType)"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" :d="eventIconPath(entry.eventType)" />
                </svg>
              </div>
              <span class="text-[10px] font-semibold uppercase tracking-wider" :class="eventColor(entry.eventType)">
                {{ entry.eventType }}
              </span>
              <span class="text-[11px] text-ink-300 ml-auto tabular-nums">{{ entry.dateShort }}</span>
            </div>
            <p class="text-sm text-ink-700 font-medium leading-snug">{{ entry.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Review metadata table -->
    <div v-if="reviewMeta" class="card p-5">
      <div class="section-label">Review Details</div>
      <dl class="mt-3 space-y-3">
        <template v-for="field in reviewMeta" :key="field.key">
          <div v-if="field.key === 'notes'" class="bg-ink-50/50 rounded-lg p-3.5">
            <dt class="text-[11px] text-ink-400 font-semibold uppercase tracking-wider mb-1.5">{{ field.label }}</dt>
            <dd class="text-sm text-ink-700 leading-relaxed">{{ field.value }}</dd>
          </div>
          <div v-else class="flex items-center gap-3">
            <dt class="text-xs text-ink-300 font-medium min-w-[120px]">{{ field.label }}</dt>
            <dd class="text-sm text-ink-700">
              <span :class="field.key === 'entry' ? 'badge ' + entryStatusColor(field.value) : ''">{{ field.value }}</span>
            </dd>
          </div>
        </template>
      </dl>
    </div>
  </div>
</template>
