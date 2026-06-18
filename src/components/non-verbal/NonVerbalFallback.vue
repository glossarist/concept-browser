<script setup lang="ts">
/**
 * NonVerbalFallback — shared loading / not-found / error state.
 *
 * Each entity display component renders its own fallback rather than
 * hoisting errors to a global banner. Per the project rule
 * "Error handling: local over global", a missing figure should not
 * break the page — it shows a compact notice inline.
 */
defineProps<{
  state: 'loading' | 'not-found' | 'error';
  kind: 'figure' | 'table' | 'formula';
  entityId: string;
  message?: string;
}>();
</script>

<template>
  <div
    class="nv-fallback"
    :class="`nv-fallback--${state}`"
    role="status"
    :aria-live="state === 'error' ? 'assertive' : 'polite'"
  >
    <template v-if="state === 'loading'">
      <span class="nv-fallback__spinner" aria-hidden="true"></span>
      Loading {{ kind }} <code>{{ entityId }}</code>…
    </template>
    <template v-else-if="state === 'not-found'">
      {{ kind }} <code>{{ entityId }}</code> not found
    </template>
    <template v-else>
      Failed to load {{ kind }} <code>{{ entityId }}</code>
      <span v-if="message" class="nv-fallback__detail">: {{ message }}</span>
    </template>
  </div>
</template>

<style scoped>
.nv-fallback {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: var(--ink-500, #666);
  background: var(--surface-alt, #f5f5f5);
  border: 1px dashed var(--ink-200, #ccc);
}
.nv-fallback--error {
  color: #b91c1c;
  background: #fef2f2;
  border-color: #fecaca;
}
.nv-fallback__spinner {
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--ink-200, #ccc);
  border-top-color: transparent;
  border-radius: 50%;
  animation: nv-spin 0.8s linear infinite;
}
@keyframes nv-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .nv-fallback__spinner { animation: none; }
}
</style>
