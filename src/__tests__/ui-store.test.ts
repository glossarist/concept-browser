import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore, type Theme } from '../stores/ui';

describe('useUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('initializes with sidebar closed', () => {
    const ui = useUiStore();
    expect(ui.sidebarOpen).toBe(false);
  });

  it('initializes with eng language selected', () => {
    const ui = useUiStore();
    expect(ui.selectedLang).toBe('eng');
  });

  it('initializes with empty search query', () => {
    const ui = useUiStore();
    expect(ui.searchQuery).toBe('');
  });

  it('toggles sidebar open/closed', () => {
    const ui = useUiStore();
    expect(ui.sidebarOpen).toBe(false);
    ui.toggleSidebar();
    expect(ui.sidebarOpen).toBe(true);
    ui.toggleSidebar();
    expect(ui.sidebarOpen).toBe(false);
  });

  it('sets language', () => {
    const ui = useUiStore();
    ui.setLang('fra');
    expect(ui.selectedLang).toBe('fra');
  });

  it('sets search query', () => {
    const ui = useUiStore();
    ui.searchQuery = 'test query';
    expect(ui.searchQuery).toBe('test query');
  });

  it('defaults theme to system', () => {
    const ui = useUiStore();
    expect(ui.themePref).toBe('system');
  });

  it('setTheme updates preference and localStorage', () => {
    const ui = useUiStore();
    ui.setTheme('dark');
    expect(ui.themePref).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('setTheme to light removes dark class', () => {
    const ui = useUiStore();
    document.documentElement.classList.add('dark');
    ui.setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggleTheme switches from light to dark', () => {
    const ui = useUiStore();
    ui.setTheme('light');
    ui.toggleTheme();
    expect(ui.themePref).toBe('dark');
  });

  it('toggleTheme switches from dark to light', () => {
    const ui = useUiStore();
    ui.setTheme('dark');
    ui.toggleTheme();
    expect(ui.themePref).toBe('light');
  });

  it('reads stored theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    // Need a new pinia to re-create the store
    setActivePinia(createPinia());
    const ui = useUiStore();
    expect(ui.themePref).toBe('dark');
  });

  it('isDark is true when theme is dark', () => {
    const ui = useUiStore();
    ui.setTheme('dark');
    expect(ui.isDark).toBe(true);
  });

  it('isDark is false when theme is light', () => {
    const ui = useUiStore();
    ui.setTheme('light');
    expect(ui.isDark).toBe(false);
  });
});
