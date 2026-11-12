import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type Theme = 'light' | 'dark' | 'system';
export type SearchSort = 'language' | 'relevance';

const SEARCH_SORT_KEY = 'searchSort';
const DEFAULT_SEARCH_SORT: SearchSort = 'language';

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getStoredTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'system';
}

function getStoredSearchSort(): SearchSort {
  const v = localStorage.getItem(SEARCH_SORT_KEY);
  return v === 'language' || v === 'relevance' ? v : DEFAULT_SEARCH_SORT;
}

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false);
  const selectedLang = ref('eng');
  const searchQuery = ref('');
  const showGraphPanel = ref(false);
  const themePref = ref<Theme>(getStoredTheme());
  const searchSort = ref<SearchSort>(getStoredSearchSort());

  const isDark = computed(() => {
    return themePref.value === 'dark' || (themePref.value === 'system' && getSystemDark());
  });

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value);
  }

  function setTheme(t: Theme) {
    themePref.value = t;
    localStorage.setItem('theme', t);
    applyTheme();
  }

  function setSearchSort(s: SearchSort) {
    searchSort.value = s;
    localStorage.setItem(SEARCH_SORT_KEY, s);
  }

  function toggleTheme() {
    if (isDark.value) {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setLang(lang: string) {
    selectedLang.value = lang;
  }

  // Apply on creation
  applyTheme();
  // React to system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref.value === 'system') applyTheme();
  });

  return { sidebarOpen, selectedLang, searchQuery, showGraphPanel, themePref, searchSort, isDark, toggleSidebar, setLang, setTheme, setSearchSort, toggleTheme };
});
