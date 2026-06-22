<script setup lang="ts">
import { computed } from 'vue';
import type { FigureImage } from 'glossarist';
import type { LocalizedString, NonVerbRepImage } from '../../adapters/non-verbal/types';
import { pickLocaleText, hasLocale } from '../../utils/locale';
import { getFactory } from '../../adapters/factory';

type ImageLike = FigureImage | NonVerbRepImage;

const props = withDefaults(defineProps<{
  images: ImageLike[];
  alt?: LocalizedString | null;
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

function imgSrc(img: ImageLike): string {
  return typeof img.src === 'string' ? img.src : '';
}
function imgFormat(img: ImageLike): string {
  const f = img.format;
  return typeof f === 'string' ? f : 'svg';
}
function imgRole(img: ImageLike): string | null {
  const r = img.role;
  return typeof r === 'string' ? r : null;
}

const altText = computed(() => pickLocaleText(props.alt ?? undefined, props.locale, props.fallbackChain));
const altMissing = computed(() => !props.alt || Object.keys(props.alt).length === 0);
const altEmpty = computed(() =>
  !!props.alt && hasLocale(props.alt, props.locale) && props.alt[props.locale] === '',
);

interface SourceVariant { src: string; type: string; media?: string; }

const sourceVariants = computed<SourceVariant[]>(() => {
  const out: SourceVariant[] = [];
  for (const img of props.images) {
    const role = imgRole(img);
    if (!role || role === 'vector' || role === 'raster') continue;
    const src = imgSrc(img);
    const format = imgFormat(img);
    if (!src) continue;
    const type = format === 'svg' ? 'image/svg+xml' : `image/${format === 'jpg' ? 'jpeg' : format}`;
    let media: string | undefined;
    if (role === 'dark') media = '(prefers-color-scheme: dark)';
    else if (role === 'light') media = '(prefers-color-scheme: light)';
    else if (role === 'print') media = 'print';
    out.push({ src: resolver.resolveImageUrl(props.datasetId, src), type, media });
  }
  return out;
});

const defaultImg = computed(() => {
  const nonRole = props.images.find(i => {
    const r = imgRole(i);
    return !r || r === 'vector' || r === 'raster';
  });
  const chosen = nonRole ?? props.images[0];
  const src = chosen ? imgSrc(chosen) : '';
  if (!src) return null;
  return {
    src: resolver.resolveImageUrl(props.datasetId, src),
    width: chosen?.width ?? undefined,
    height: chosen?.height ?? undefined,
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
