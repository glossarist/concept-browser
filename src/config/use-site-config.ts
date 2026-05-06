import { ref, computed } from 'vue';
import type { PageConfig } from './types';

export interface RuntimeSiteConfig {
  id: string;
  domain: string;
  title: string;
  subtitle?: string;
  description?: string;
  datasets: string[];
  defaultDataset?: string;
  branding?: {
    primaryColor?: string;
    darkColor?: string;
    fonts?: {
      header?: { family: string; source: string; weights?: number[]; url?: string };
      body?: { family: string; source: string; weights?: number[]; url?: string };
    };
    logo?: { path: string; alt: string; url?: string };
    footerLogo?: { path: string; alt: string; url?: string };
    ownerName?: string;
    ownerUrl?: string;
  };
  analytics?: { googleAnalyticsId?: string };
  features?: Record<string, unknown>;
  social?: Record<string, string>;
  nav?: { label: string; route: string }[];
  footerNav?: { label: string; route: string }[];
  defaults?: { language?: string; languageOrder?: string[] };
  email?: string;
  pages?: PageConfig[];
}

const siteConfig = ref<RuntimeSiteConfig | null>(null);
const loaded = ref(false);

function loadFont(font: { family: string; source: string; weights?: number[]; url?: string }) {
  if (font.source === 'google') {
    const w = (font.weights || [400, 700]).join(';');
    const href = `https://fonts.googleapis.com/css2?family=${font.family.replace(/ /g, '+')}:wght@${w}&display=swap`;
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  if (font.source === 'url' && font.url) {
    const existing = document.querySelector(`link[href="${font.url}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.url;
    document.head.appendChild(link);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function applyBranding(config: RuntimeSiteConfig) {
  const root = document.documentElement;
  const b = config.branding;
  if (!b) return;

  if (b.primaryColor) {
    root.style.setProperty('--brand-primary', b.primaryColor);
    const [r, g, bl] = hexToRgb(b.primaryColor);
    root.style.setProperty('--brand-primary-rgb', `${r}, ${g}, ${bl}`);
  }
  if (b.darkColor) {
    root.style.setProperty('--brand-dark', b.darkColor);
  }

  if (b.fonts?.header) {
    loadFont(b.fonts.header);
    root.style.setProperty('--font-header', `'${b.fonts.header.family}', Georgia, serif`);
  }
  if (b.fonts?.body) {
    loadFont(b.fonts.body);
    root.style.setProperty('--font-body', `'${b.fonts.body.family}', system-ui, sans-serif`);
  }
}

async function loadConfig(): Promise<RuntimeSiteConfig | null> {
  if (loaded.value) return siteConfig.value;
  try {
    const resp = await fetch('/site-config.json');
    if (resp.ok) {
      siteConfig.value = await resp.json();
      if (siteConfig.value) applyBranding(siteConfig.value);
    }
  } catch {
    // Non-critical
  }
  loaded.value = true;
  return siteConfig.value;
}

const BUILTIN_GLOBAL_PAGES: PageConfig[] = [
  { type: 'custom', route: '', title: 'Home', icon: 'home' },
  { type: 'custom', route: 'search', title: 'Search', icon: 'search' },
  { type: 'custom', route: 'graph', title: 'Graph', icon: 'graph' },
];

const BUILTIN_DATASET_PAGES: PageConfig[] = [
  { type: 'custom', route: '', title: 'Concepts', icon: 'list' },
  { type: 'stats', route: 'stats', title: 'Statistics', icon: 'chart' },
  { type: 'about', route: 'about', title: 'About', icon: 'info' },
];

function synthesizePages(features?: Record<string, unknown>, pages?: PageConfig[]) {
  if (pages && pages.length > 0) return pages;

  const result = [...BUILTIN_GLOBAL_PAGES];
  if (features?.news) {
    result.push({ type: 'news', route: 'news', title: 'News', icon: 'newspaper' });
  }
  return result;
}

export function useSiteConfig() {
  const config = computed(() => siteConfig.value);
  const visibleDatasets = computed(() => siteConfig.value?.datasets ?? []);

  const globalPages = computed<PageConfig[]>(() =>
    synthesizePages(siteConfig.value?.features, siteConfig.value?.pages)
      .filter(p => !p.datasetScoped),
  );

  const datasetPages = computed<PageConfig[]>(() => {
    const declared = siteConfig.value?.pages?.filter(p => p.datasetScoped) ?? [];
    if (declared.length > 0) return declared;
    return BUILTIN_DATASET_PAGES;
  });

  return { config, visibleDatasets, loadConfig, globalPages, datasetPages };
}
