<script setup lang="ts">
/**
 * NonVerbalCaption — shared caption + identifier + description.
 *
 * Renders identically for Figure, Table, Formula. The shape:
 *
 *   <figcaption>
 *     <span class="nv-caption__identifier">Figure 7c.</span>
 *     <span class="nv-caption__text" lang="en">Caption text.</span>
 *     <details>
 *       <summary>Detailed description</summary>
 *       <p lang="en">Long description text.</p>
 *     </details>
 *   </figcaption>
 *
 * The `lang` attribute reflects the ACTUAL resolved locale (not the
 * requested one), so a French page with an English-only caption shows
 * `lang="en"` on the caption — correct for screen readers.
 */
import { computed } from 'vue';
import type { LocalizedString } from '../../adapters/non-verbal/types';
import { pickLocaleMap, localeToBcp47 } from '../../utils/locale';

const props = defineProps<{
  identifier?: string;
  caption?: LocalizedString;
  description?: LocalizedString;
  locale: string;
  fallbackChain?: readonly string[];
  descriptionId?: string;
}>();

const captionResolved = computed(() =>
  pickLocaleMap(props.caption, props.locale, props.fallbackChain),
);

const descriptionResolved = computed(() =>
  pickLocaleMap(props.description, props.locale, props.fallbackChain),
);

const captionLang = computed(() =>
  captionResolved.value ? localeToBcp47(captionResolved.value.locale) : undefined,
);

const descriptionLang = computed(() =>
  descriptionResolved.value ? localeToBcp47(descriptionResolved.value.locale) : undefined,
);
</script>

<template>
  <figcaption class="nv-caption">
    <span v-if="identifier" class="nv-caption__identifier">{{ identifier }}.</span>
    <span
      v-if="captionResolved"
      class="nv-caption__text"
      :lang="captionLang"
    >{{ captionResolved.text }}</span>
    <details
      v-if="descriptionResolved"
      :id="descriptionId"
      class="nv-caption__desc"
    >
      <summary>Detailed description</summary>
      <p :lang="descriptionLang">{{ descriptionResolved.text }}</p>
    </details>
  </figcaption>
</template>

<style scoped>
.nv-caption {
  font-size: 0.875rem;
  color: var(--ink-700, #444);
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.nv-caption__identifier {
  font-weight: 600;
  color: var(--ink-800, #222);
}
.nv-caption__text {
  font-style: italic;
}
.nv-caption__desc {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: var(--ink-500, #666);
}
.nv-caption__desc > summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--ink-600, #555);
}
.nv-caption__desc > p {
  margin-top: 0.5rem;
  line-height: 1.6;
}

@media (prefers-contrast: more) {
  .nv-caption__text { font-weight: 600; }
  .nv-caption__identifier { font-weight: 700; }
}
</style>
