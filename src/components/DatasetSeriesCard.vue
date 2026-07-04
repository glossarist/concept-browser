<script setup lang="ts">
/**
 * DatasetSeriesCard — sidebar widget showing all editions of the same
 * vocabulary series as the current dataset. Click any edition to navigate.
 *
 * Plugged into the DatasetView main column so users browsing viml-2022 see the
 * 1968 / 2000 / 2013 / 2022 family at a glance. Dark-mode aware via the
 * `theme-dark` class (driven by uiStore.isDark).
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDatasetSeries } from '../composables/useDatasetSeries';
import { useUiStore } from '../stores/ui';

const props = defineProps<{
  registerId: string;
}>();

const router = useRouter();
const uiStore = useUiStore();

const { seriesForActive } = useDatasetSeries(() => props.registerId);
const series = computed(() => seriesForActive.value);

function navigate(registerId: string) {
  if (registerId === props.registerId) return;
  router.push({ name: 'dataset', params: { registerId } });
}

function memberBadge(member: { isCurrent: boolean; isActive: boolean; status: string }): string | null {
  if (member.isActive) return 'viewing';
  if (member.isCurrent) return 'current';
  if (member.status === 'withdrawn' || member.status === 'superseded') return 'archived';
  return null;
}
</script>

<template>
  <section
    v-if="series && series.members.length > 1"
    :class="['series-card', { 'theme-dark': uiStore.isDark }]"
    :aria-label="`Series ${series.title}`"
  >
    <header class="series-head">
      <span class="series-label">Edition series</span>
      <span class="series-key">{{ series.key }}</span>
    </header>

    <h3 class="series-title">{{ series.title }}</h3>

    <div class="series-meta">
      <span class="series-count">{{ series.members.length }} editions</span>
      <span class="series-sep">·</span>
      <span class="series-total">{{ series.totalConcepts.toLocaleString() }} concepts</span>
    </div>

    <ol class="series-list">
      <li
        v-for="member in [...series.members].reverse()"
        :key="member.id"
        :class="['series-item', { active: member.isActive }]"
      >
        <button
          class="series-button"
          :disabled="member.isActive"
          @click="navigate(member.id)"
        >
          <span class="series-year">{{ member.year ?? '—' }}</span>
          <span class="series-detail">
            <span class="series-ref">{{ member.ref }}</span>
            <span v-if="member.conceptCount" class="series-concepts">
              {{ member.conceptCount.toLocaleString() }} concepts
            </span>
          </span>
          <span
            v-if="memberBadge(member)"
            class="series-badge"
            :class="{
              'badge-current': memberBadge(member) === 'current',
              'badge-viewing': memberBadge(member) === 'viewing',
              'badge-archived': memberBadge(member) === 'archived',
            }"
          >
            {{ memberBadge(member) }}
          </span>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* Light theme tokens */
.series-card {
  --sc-bg: linear-gradient(180deg, rgba(255, 252, 240, 0.96) 0%, rgba(248, 240, 220, 0.92) 100%);
  --sc-bg-solid: #FFFCF2;
  --sc-ink: #0F1A30;
  --sc-ink-soft: #2D3A52;
  --sc-ink-mute: #5A6577;
  --sc-rule: rgba(184, 147, 90, 0.30);
  --sc-gold: #B8935A;
  --sc-gold-deep: #8C6A3A;
  --sc-badge-text: #FFFCF2;

  background: var(--sc-bg);
  border: 1px solid var(--sc-rule);
  border-radius: 8px;
  padding: 14px 16px 10px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 4px 14px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  color: var(--sc-ink);
}

/* Dark theme */
.series-card.theme-dark,
:global(.dark) .series-card {
  --sc-bg: linear-gradient(180deg, rgba(36, 38, 60, 0.96) 0%, rgba(28, 30, 50, 0.92) 100%);
  --sc-bg-solid: #1c1e32;
  --sc-ink: #f0f0f4;
  --sc-ink-soft: #dddde6;
  --sc-ink-mute: #8d8faa;
  --sc-rule: rgba(212, 175, 110, 0.40);
  --sc-gold: #D4AF6E;
  --sc-gold-deep: #B8935A;
  --sc-badge-text: #1c1e32;
}

.series-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}
.series-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--sc-gold-deep);
}
.series-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--sc-ink-mute);
  font-weight: 600;
}

.series-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 15px;
  color: var(--sc-ink);
  margin: 0 0 4px;
  line-height: 1.2;
  letter-spacing: -0.005em;
}

.series-meta {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 10.5px;
  color: var(--sc-ink-mute);
  margin-bottom: 10px;
  letter-spacing: 0.02em;
}
.series-sep { margin: 0 6px; opacity: 0.6; }

.series-list { list-style: none; padding: 0; margin: 0; }

.series-item {
  position: relative;
  margin-bottom: 1px;
}
.series-item.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--sc-gold);
  border-radius: 1px;
}

.series-button {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  background: transparent;
  border: none;
  padding: 7px 6px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  border-radius: 4px;
  transition: background 0.15s;
  color: inherit;
}
.series-button:hover:not(:disabled) {
  background: rgba(184, 147, 90, 0.10);
}
.series-button:disabled { cursor: default; }

.series-year {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--sc-ink);
  letter-spacing: 0.02em;
  min-width: 38px;
  flex-shrink: 0;
}
.series-item.active .series-year { color: var(--sc-gold-deep); }

.series-detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.series-ref {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--sc-ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.series-concepts {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 9px;
  color: var(--sc-ink-mute);
  font-style: italic;
  text-transform: lowercase;
  margin-top: 1px;
}

.series-badge {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  padding: 2px 6px;
  border-radius: 2px;
  flex-shrink: 0;
}
.badge-current {
  /* Outlined style — gold text on the card's surface color, with a thin
     gold border. Contrast: ~12:1 in light mode, ~10:1 in dark mode.
     The filled variant had white-on-gold which capped at 2.7:1 (light) /
     2.0:1 (dark) — well below WCAG AA for small text. */
  background: rgba(184, 147, 90, 0.10);
  color: var(--sc-gold-deep);
  border: 1px solid var(--sc-gold);
}
:global(.dark) .badge-current {
  background: rgba(212, 175, 110, 0.12);
  color: var(--sc-gold);
}
.badge-viewing {
  background: var(--sc-gold-deep);
  color: var(--sc-badge-text);
}
.badge-archived {
  background: rgba(168, 168, 155, 0.18);
  color: var(--sc-ink-mute);
}
</style>
