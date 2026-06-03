<script setup lang="ts">
import { useI18n } from '../i18n';

const { t } = useI18n();

defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="$emit('close')">
      <div class="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-ink-100">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-ink-800">{{ t('shortcuts.title') }}</h3>
          <button @click="$emit('close')" class="p-1 rounded hover:bg-ink-50 text-ink-400 hover:text-ink-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-ink-600">{{ t('shortcuts.previous') }}</span>
            <kbd class="px-2 py-1 bg-ink-50 border border-ink-200 rounded text-xs font-mono">J</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-ink-600">{{ t('shortcuts.next') }}</span>
            <kbd class="px-2 py-1 bg-ink-50 border border-ink-200 rounded text-xs font-mono">K</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-ink-600">{{ t('shortcuts.search') }}</span>
            <kbd class="px-2 py-1 bg-ink-50 border border-ink-200 rounded text-xs font-mono">/</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-ink-600">{{ t('shortcuts.showShortcuts') }}</span>
            <kbd class="px-2 py-1 bg-ink-50 border border-ink-200 rounded text-xs font-mono">?</kbd>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-ink-600">{{ t('shortcuts.closeDialog') }}</span>
            <kbd class="px-2 py-1 bg-ink-50 border border-ink-200 rounded text-xs font-mono">Esc</kbd>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-ink-100 text-xs text-ink-300 text-center">
          {{ t('shortcuts.hint') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>
