<script setup lang="ts">
/**
 * SidebarSeriesSection — compact version of the dataset series list for the
 * AppSidebar. Shows all multi-edition series as collapsible groups with their
 * editions as clickable items.
 *
 * Designed to fit the sidebar's existing visual language: small text, gold
 * accents, ink-100 borders. Uses Tailwind dark: classes for theme switching.
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDatasetSeries } from '../composables/useDatasetSeries';

const router = useRouter();
const { series } = useDatasetSeries();

const multiEditionSeries = computed(() =>
  series.value.filter(s => s.members.length > 1)
);

/* Collapse state — start expanded for the active series, collapsed otherwise */
const collapsed = ref<Set<string>>(new Set());
function toggle(key: string) {
  const next = new Set(collapsed.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsed.value = next;
}
function isCollapsed(key: string) {
  return collapsed.value.has(key);
}

function navigate(registerId: string) {
  router.push({ name: 'dataset', params: { registerId } });
}
</script>

<template>
  <div v-if="multiEditionSeries.length" class="sidebar-series">
    <div class="section-label">Edition Series</div>
    <div class="series-list">
      <div v-for="s in multiEditionSeries" :key="s.key" class="series-block">
        <button
          class="series-header"
          @click="toggle(s.key)"
        >
          <span class="series-chevron">{{ isCollapsed(s.key) ? '▸' : '▾' }}</span>
          <span class="series-title">{{ s.title }}</span>
          <span class="series-count">{{ s.members.length }}</span>
        </button>
        <ol v-if="!isCollapsed(s.key)" class="series-editions">
          <li
            v-for="member in [...s.members].reverse()"
            :key="member.id"
            :class="['edition-row', { active: member.isActive, current: member.isCurrent }]"
          >
            <button class="edition-button" @click="navigate(member.id)">
              <span class="edition-year">{{ member.year ?? '—' }}</span>
              <span class="edition-meta">
                <span v-if="member.isActive" class="edition-mark">●</span>
                <span v-else-if="member.isCurrent" class="edition-mark current">◆</span>
              </span>
            </button>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-series {
  margin-bottom: 1.5rem;
}
.section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: theme('colors.ink.300');
  margin-bottom: 0.5rem;
}
:global(.dark) .section-label {
  color: theme('colors.ink.400');
}

.series-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.series-block {
  border-radius: 6px;
}

.series-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: theme('colors.ink.700');
  font-size: 12px;
  font-weight: 600;
  transition: background 0.15s;
}
.series-header:hover {
  background: theme('colors.ink.50');
}
:global(.dark) .series-header {
  color: theme('colors.ink.200');
}
:global(.dark) .series-header:hover {
  background: theme('colors.ink.700');
}
.series-chevron {
  font-size: 10px;
  width: 0.625rem;
  color: theme('colors.ink.300');
}
.series-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: -0.005em;
}
.series-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: theme('colors.ink.300');
  background: theme('colors.ink.50');
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
:global(.dark) .series-count {
  background: theme('colors.ink.700');
  color: theme('colors.ink.300');
}

.series-editions {
  list-style: none;
  padding: 0 0 0 0.625rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.edition-row {
  position: relative;
}

.edition-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.25rem 0.5rem 0.25rem 0.875rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  color: theme('colors.ink.500');
  font-size: 11px;
  transition: all 0.15s;
  position: relative;
}
.edition-button::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: theme('colors.ink.200');
}
.edition-button:hover {
  background: theme('colors.ink.50');
  color: theme('colors.ink.800');
}
:global(.dark) .edition-button {
  color: theme('colors.ink.400');
}
:global(.dark) .edition-button:hover {
  background: theme('colors.ink.700');
  color: theme('colors.ink.100');
}

.edition-row.active .edition-button {
  color: #B8935A;
  font-weight: 600;
  background: rgba(184, 147, 90, 0.08);
}
.edition-row.active .edition-button::before {
  background: #B8935A;
  width: 5px;
  height: 5px;
  box-shadow: 0 0 0 2px rgba(184, 147, 90, 0.20);
}
.edition-row.current:not(.active) .edition-button::before {
  background: #B8935A;
}

.edition-year {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
.edition-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.edition-mark {
  font-size: 7px;
  color: theme('colors.ink.300');
}
.edition-mark.current {
  color: #B8935A;
  font-size: 9px;
}
</style>
