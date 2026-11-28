<script setup lang="ts">
/**
 * NavigationTree — collapsible tree pane for the Browse view (issue #261).
 *
 * Hand-rolled (no tree library): renders only the expanded frontier
 * (flattenTree), so collapsed registers cost a handful of DOM nodes.
 * Rows beyond the reveal cap page in on demand — the same incremental
 * reveal the curation queues use for large lists. Keyboard navigation
 * follows the WAI-ARIA tree pattern: ↑/↓ move, → expands, ← collapses
 * (or jumps to the parent), Enter selects.
 */
import { computed, ref } from 'vue';
import { useI18n } from '../i18n';
import { flattenTree, treeKindLabelKey, type FlattenedTreeNode } from '../utils/navigation-tree';
import type { NavigationNode, NavigationTreeKind } from '../adapters/navigation-index';

const props = defineProps<{
  kind: NavigationTreeKind;
  roots: NavigationNode[];
  selectedId: string | null;
}>();

const emit = defineEmits<{ select: [id: string] }>();

const { t } = useI18n();
const treeKindLabel = computed(() => treeKindLabelKey(props.kind));

// Roots start collapsed (a register's top level is the overview the
// user expands into); selection state lives in the parent view.
const expanded = ref<Set<string>>(new Set());
const activeIndex = ref(0);

function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function select(node: NavigationNode) {
  emit('select', props.selectedId === node.id ? '' : node.id);
}

const rows = computed<FlattenedTreeNode[]>(() => flattenTree(props.roots, expanded.value));

// Incremental reveal: pathological expansions (a 5k-child hierarchy)
// render the first PAGE rows and grow on demand.
const PAGE = 300;
const revealed = ref(PAGE);
const visibleRows = computed(() => rows.value.slice(0, revealed.value));
const hiddenCount = computed(() => Math.max(0, rows.value.length - revealed.value));

function revealMore() {
  revealed.value += PAGE;
}

function clampActive() {
  const max = Math.max(0, visibleRows.value.length - 1);
  if (activeIndex.value > max) activeIndex.value = max;
}

function onKeydown(e: KeyboardEvent) {
  const rowsNow = visibleRows.value;
  if (rowsNow.length === 0) return;
  const row = rowsNow[activeIndex.value];
  if (!row) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 1, rowsNow.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, 0);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (row.hasChildren && !expanded.value.has(row.node.id)) toggle(row.node.id);
      else if (activeIndex.value < rowsNow.length - 1) activeIndex.value += 1;
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (row.hasChildren && expanded.value.has(row.node.id)) toggle(row.node.id);
      else {
        const parentIndex = rowsNow.findIndex(r => r.node.id === row.parentId);
        if (parentIndex >= 0) activeIndex.value = parentIndex;
      }
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      select(row.node);
      break;
    default:
      return;
  }
}
</script>

<template>
  <div
    v-if="roots.length"
    role="tree"
    data-testid="navigation-tree"
    :aria-label="t(treeKindLabel)"
    class="card overflow-hidden"
    tabindex="0"
    @keydown="onKeydown"
  >
    <ul class="max-h-[32rem] overflow-auto" role="presentation">
      <li
        v-for="(row, i) in visibleRows"
        :key="row.node.id"
        role="none"
      >
        <button
          type="button"
          role="treeitem"
          :aria-expanded="row.hasChildren ? expanded.has(row.node.id) : undefined"
          :aria-selected="selectedId === row.node.id"
          :aria-level="row.depth + 1"
          :tabindex="i === activeIndex ? 0 : -1"
          :data-testid="`tree-node-${row.node.id}`"
          class="flex w-full items-center gap-1 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors focus:outline-none focus:bg-ink-50 dark:focus:bg-ink-800"
          :class="selectedId === row.node.id ? 'bg-ink-50 dark:bg-ink-800 font-medium' : ''"
          @click="select(row.node)"
        >
          <span
            v-if="row.hasChildren"
            class="shrink-0 w-5 h-5 inline-flex items-center justify-center text-ink-400 hover:text-ink-700"
            :data-testid="`tree-toggle-${row.node.id}`"
            :aria-label="expanded.has(row.node.id) ? t('browse.tree.collapse') : t('browse.tree.expand')"
            role="button"
            tabindex="-1"
            @click.stop="toggle(row.node.id)"
          >
            <svg
              class="w-3.5 h-3.5 transition-transform"
              :class="expanded.has(row.node.id) ? 'rotate-90' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span v-else class="shrink-0 w-5 h-5 inline-block" aria-hidden="true"></span>
          <span
            class="truncate py-1.5"
            :style="{ paddingLeft: `${row.depth * 0.25}rem` }"
          >{{ row.node.label || row.node.id }}</span>
          <span v-if="row.node.count != null" class="ml-auto pr-3 text-xs text-ink-400">{{ row.node.count }}</span>
        </button>
      </li>
    </ul>
    <div v-if="hiddenCount > 0" class="border-t border-ink-50 dark:border-ink-700/60 p-2 text-center">
      <button type="button" class="btn-secondary text-xs" @click="revealMore">
        {{ t('curation.showMore', { count: String(Math.min(PAGE, hiddenCount)) }) }}
      </button>
    </div>
  </div>
  <div v-else class="card p-4 text-sm text-ink-500 dark:text-ink-300">
    {{ t('browse.tree.empty') }}
  </div>
</template>

