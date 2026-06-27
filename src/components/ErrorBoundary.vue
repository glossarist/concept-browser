<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { GlossaristError, formatError, isGlossaristError } from '../errors';

defineOptions({ name: 'ErrorBoundary' });

const props = defineProps<{
  title?: string;
  retryKey?: string | number;
}>();

const emit = defineEmits<{ (e: 'error', err: unknown): void }>();

const error = ref<GlossaristError | Error | null>(null);

onErrorCaptured((err: unknown) => {
  error.value = err instanceof Error ? err : new Error(String(err));
  emit('error', err);
  return false;
});

function dismiss() {
  error.value = null;
}
</script>

<template>
  <slot v-if="!error" />
  <div
    v-else
    class="error-boundary"
    :data-retry-key="props.retryKey"
    role="alert"
    aria-live="assertive"
  >
    <div class="error-boundary__header">
      <h3>{{ props.title ?? 'Something went wrong' }}</h3>
      <button type="button" class="error-boundary__retry" @click="dismiss">
        Retry
      </button>
    </div>
    <p class="error-boundary__message">{{ error.message }}</p>
    <details v-if="isGlossaristError(error)" class="error-boundary__details">
      <summary>Details</summary>
      <pre dir="auto">{{ formatError(error) }}</pre>
    </details>
  </div>
</template>

<style scoped>
.error-boundary {
  border: 1px solid #fca5a5;
  background: #fef2f2;
  color: #7f1d1d;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
}
.error-boundary__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.error-boundary__header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.error-boundary__retry {
  background: transparent;
  border: 1px solid currentColor;
  color: inherit;
  border-radius: 0.25rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  cursor: pointer;
}
.error-boundary__message {
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
}
.error-boundary__details {
  margin-top: 0.5rem;
}
.error-boundary__details summary {
  cursor: pointer;
  font-size: 0.85rem;
}
.error-boundary__details pre {
  margin: 0.5rem 0 0;
  white-space: pre-wrap;
  font-size: 0.8rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
