<script setup lang="ts">
/**
 * HomeSeriesSection — vocabulary series overview for the home page.
 *
 * Groups all loaded datasets into series (e.g., all `viml-*` editions
 * together) and renders each as a horizontal timeline of edition pills.
 * The newest valid edition is highlighted; older editions are subtler.
 *
 * Only renders if at least one series has 2+ members — single-edition
 * vocabs don't benefit from this view. Theme-aware (light/dark).
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useDatasetSeries } from '../composables/useDatasetSeries';

const router = useRouter();
const uiStore = useUiStore();
const { series } = useDatasetSeries();

const multiEditionSeries = computed(() =>
  series.value.filter(s => s.members.length > 1)
);

function openDataset(registerId: string) {
  router.push({ name: 'dataset', params: { registerId } });
}
</script>

<template>
  <section
    v-if="multiEditionSeries.length"
    :class="['series-section', { 'theme-dark': uiStore.isDark }]"
    aria-label="Vocabulary edition series"
  >
    <header class="series-section-head">
      <span class="series-section-ornament">✦</span>
      <div>
        <h2 class="series-section-title">Vocabulary Series</h2>
        <p class="series-section-sub">Multi-edition terminology archives · click any edition</p>
      </div>
    </header>

    <div class="series-grid">
      <article
        v-for="s in multiEditionSeries"
        :key="s.key"
        class="series-article"
      >
        <header class="series-article-head">
          <h3 class="series-article-title">{{ s.title }}</h3>
          <span class="series-article-meta">
            {{ s.members.length }} editions · {{ s.totalConcepts.toLocaleString() }} concepts
          </span>
        </header>

        <ol class="series-timeline">
          <li
            v-for="member in s.members"
            :key="member.id"
            :class="['timeline-item', { current: member.isCurrent }]"
          >
            <button
              class="timeline-button"
              :class="{ current: member.isCurrent }"
              @click="openDataset(member.id)"
            >
              <span class="timeline-year">{{ member.year ?? '—' }}</span>
              <span class="timeline-status">{{ member.status }}</span>
              <span v-if="member.isCurrent" class="timeline-mark">◆</span>
            </button>
          </li>
        </ol>
      </article>
    </div>
  </section>
</template>

<style scoped>
/* Light theme (default) — warm parchment */
.series-section {
  --hs-bg: transparent;
  --hs-ink: #0F1A30;
  --hs-ink-soft: #2D3A52;
  --hs-ink-mute: #5A6577;
  --hs-rule: rgba(184, 147, 90, 0.25);
  --hs-card-bg: linear-gradient(180deg, rgba(255, 252, 240, 0.96) 0%, rgba(248, 240, 220, 0.92) 100%);
  --hs-timeline-bg: rgba(255, 255, 255, 0.6);
  --hs-timeline-border: rgba(184, 147, 90, 0.20);
  --hs-timeline-hover: rgba(255, 252, 240, 1);
  --hs-gold: #B8935A;
  --hs-gold-deep: #8C6A3A;
  --hs-gold-tint: rgba(184, 147, 90, 0.12);

  max-width: 80rem;
  margin: 3rem auto 4rem;
  padding: 0 1rem;
  color: var(--hs-ink);
}

/* Dark theme */
.series-section.theme-dark,
:global(.dark) .series-section {
  --hs-bg: transparent;
  --hs-ink: #f0f0f4;
  --hs-ink-soft: #dddde6;
  --hs-ink-mute: #8d8faa;
  --hs-rule: rgba(184, 147, 90, 0.30);
  --hs-card-bg: linear-gradient(180deg, rgba(36, 38, 60, 0.96) 0%, rgba(28, 30, 50, 0.92) 100%);
  --hs-timeline-bg: rgba(28, 30, 50, 0.6);
  --hs-timeline-border: rgba(184, 147, 90, 0.25);
  --hs-timeline-hover: rgba(36, 38, 60, 1);
  --hs-gold: #D4AF6E;
  --hs-gold-deep: #B8935A;
  --hs-gold-tint: rgba(212, 175, 110, 0.15);
}

.series-section-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--hs-rule);
}
.series-section-ornament {
  color: var(--hs-gold);
  font-size: 22px;
  transform: rotate(45deg);
  display: inline-block;
}
.series-section-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 28px;
  color: var(--hs-ink);
  letter-spacing: -0.015em;
  line-height: 1;
  margin: 0;
}
.series-section-sub {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 12px;
  color: var(--hs-ink-mute);
  margin-top: 4px;
  font-style: italic;
  letter-spacing: 0.02em;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 1.25rem;
}

.series-article {
  background: var(--hs-card-bg);
  border: 1px solid var(--hs-rule);
  border-radius: 10px;
  padding: 18px 22px 16px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    0 6px 20px rgba(0, 0, 0, 0.10);
}

.series-article-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}
.series-article-title {
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 17px;
  color: var(--hs-ink);
  line-height: 1.15;
  letter-spacing: -0.005em;
  margin: 0;
}
.series-article-meta {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 10.5px;
  color: var(--hs-ink-mute);
  letter-spacing: 0.04em;
  text-transform: lowercase;
}

.series-timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: stretch;
}

.timeline-item {
  position: relative;
}
.timeline-item:not(:last-child)::after {
  content: '→';
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--hs-gold);
  opacity: 0.5;
  pointer-events: none;
}

.timeline-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px 6px;
  background: var(--hs-timeline-bg);
  border: 1px solid var(--hs-timeline-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  min-width: 64px;
  position: relative;
  color: var(--hs-ink);
}
.timeline-button:hover {
  background: var(--hs-timeline-hover);
  border-color: var(--hs-gold);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--hs-gold-tint);
}
.timeline-button.current {
  background: var(--hs-timeline-hover);
  border-color: var(--hs-gold);
  box-shadow:
    0 0 0 3px var(--hs-gold-tint),
    0 2px 8px var(--hs-gold-tint);
}

.timeline-year {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--hs-ink);
  letter-spacing: 0.02em;
}
.timeline-button.current .timeline-year {
  color: var(--hs-gold-deep);
}

.timeline-status {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 8.5px;
  color: var(--hs-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
}

.timeline-mark {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 14px;
  height: 14px;
  background: var(--hs-gold);
  color: white;
  border-radius: 50%;
  font-size: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
</style>
