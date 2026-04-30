import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false);
  const selectedLang = ref('eng');
  const searchQuery = ref('');
  const showGraphPanel = ref(false);

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setLang(lang: string) {
    selectedLang.value = lang;
  }

  return { sidebarOpen, selectedLang, searchQuery, showGraphPanel, toggleSidebar, setLang };
});
