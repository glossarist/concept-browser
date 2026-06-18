<script setup lang="ts">
import { computed } from 'vue';
import type { FigureImage, LocalizedString } from '../../adapters/non-verbal/types';
import { pickLocaleText, hasLocale } from '../../utils/locale';
import { getFactory } from '../../adapters/factory';

const props = withDefaults(defineProps<{
  images: FigureImage[];
  alt?: LocalizedString;
  datasetId: string;
  locale: string;
  fallbackChain?: readonly string[];
  descriptionId?: string;
  hasDescription?: boolean;
  entityLabel?: string;
}>(), {
  entityLabel: 'Figure',
});

const resolver = getFactory().nonVerbalResolver;

const altText = computed(() => pickLocaleText(props.alt, props.locale, props.fallbackChain));
const altMissing = computed(() => !props.alt || Object.keys(props.alt).length === 0);
const altEmpty = computed(() =>
  !!props.alt && hasLocale(props.alt, props.locale) && props.alt[props.locale] === '',
);

interface SourceVariant { src: string; type: string; media?: string; }

const sourceVariants = computed<SourceVariant[]>(() => {
  const out: SourceVariant[] = [];
  for (const img of props.images) {
    if (!img.role || img.role === 'vector' || img.role === 'raster') continue;
    const src = resolver.resolveImageUrl(props.datasetId, img.src);
    const type = img.format === 'svg' ? 'image/svg+xml' : `image/${img.format === 'jpg' ? 'jpeg' : img.format}`;
    let media: string | undefined;
    if (img.role === 'dark') media = '(prefers-color-scheme: dark)';
    else if (img.role === 'light') media = '(prefers-color-scheme: light)';
    else if (img.role === 'print') media = 'print';
    out.push({ src, type, media });
  }
  return out;
});

const defaultImg = computed(() => {
  const nonRole = props.images.find(i => !i.role || i.role === 'vector' || i.role === 'raster');
  const chosen = nonRole ?? props.images[0];
  if (!chosen) return null;
  return {
    src: resolver.resolveImageUrl(props.datasetId, chosen.src),
    width: chosen.width,
    height: chosen.height,
  };
});
</script>

<template>
  <div class="figure__images">
    <picture v-if="!altMissing">
      <source
        v-for="(v, i) in sourceVariants"
        :key="i"
        :type="v.type"
        :srcset="v.src"
        :media="v.media"
      />
      <img
        v-if="defaultImg"
        :src="defaultImg.src"
        :alt="altEmpty ? '' : altText"
        :width="defaultImg.width"
        :height="defaultImg.height"
        loading="lazy"
        :aria-describedby="hasDescription && descriptionId ? descriptionId : undefined"
        class="figure__img"
      >
    </picture>
    <div
      v-else
      class="figure__alt-missing"
      role="img"
      :aria-label="`${entityLabel} is missing alt text`"
    >
      <p>{{ entityLabel }}: alt text missing</p>
    </div>
  </div>
</template>

<style scoped>
.figure__images {
  margin: 0;
}
.figure__img {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 0.375rem;
}
.figure__alt-missing {
  padding: 1rem;
  background: #fef3c7;
  border: 1px dashed #d97706;
  border-radius: 0.375rem;
  color: #92400e;
  font-size: 0.8125rem;
}

@media (prefers-color-scheme: dark) {
  .figure__img { background: var(--surface-alt, #222); }
}
</style>
