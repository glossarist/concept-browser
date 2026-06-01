import { ref, computed } from 'vue';
import type { PageConfig } from './types';
import { locale } from '../i18n';

export interface RuntimeSiteConfig {
  id: string;
  domain: string;
  uriBase?: string;
  title: string;
  subtitle?: string;
  description?: string;
  translations?: Record<string, { title?: string; subtitle?: string; description?: string }>;
  datasetTranslations?: Record<string, Record<string, { title?: string; description?: string }>>;
  datasets: string[];
  defaultDataset?: string;
  uiLanguages?: { code: string; label: string }[];
  branding?: {
    primaryColor?: string;
    darkColor?: string;
    fonts?: {
      header?: { family: string; source: string; weights?: number[]; url?: string };
      body?: { family: string; source: string; weights?: number[]; url?: string };
    };
    logo?: { path: string; alt: string; url?: string; light?: string; dark?: string };
    footerLogo?: { path: string; alt: string; url?: string; light?: string; dark?: string };
    ownerName?: string;
    ownerUrl?: string;
  };
  analytics?: { googleAnalyticsId?: string };
  features?: Record<string, unknown>;
  social?: Record<string, string>;
  nav?: { label: string; route: string }[];
  footerNav?: { label: string; route: string }[];
  defaults?: { language?: string; languageOrder?: string[]; mainLanguages?: string[] };
  email?: string;
  pages?: PageConfig[];
  contributors?: { name: string; role?: string; organization?: string; url?: string; email?: string }[];
  copyright?: string;
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
    const resp = await fetch(`${import.meta.env.BASE_URL}site-config.json`);
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

function synthesizeGlobalPages(features?: Record<string, unknown>, pages?: PageConfig[]): PageConfig[] {
  const declared = pages?.filter(p => !p.datasetScoped) ?? [];
  const declaredRoutes = new Set(declared.map(p => p.route));

  const result: PageConfig[] = [
    { type: 'custom', route: '', title: 'Home', icon: 'home' },
  ];
  if (features?.search !== false && !declaredRoutes.has('search')) {
    result.push({ type: 'custom', route: 'search', title: 'Search', icon: 'search' });
  }
  if (features?.graph !== false && !declaredRoutes.has('graph')) {
    result.push({ type: 'custom', route: 'graph', title: 'Graph', icon: 'graph' });
  }
  if (features?.ontology !== false && !declaredRoutes.has('ontology')) {
    result.push({ type: 'custom', route: 'ontology', title: 'Ontology', icon: 'schema' });
  }
  if (features?.news && !declaredRoutes.has('news')) {
    result.push({ type: 'news', route: 'news', title: 'News', icon: 'newspaper' });
  }

  return [...result, ...declared];
}

function synthesizeDatasetPages(features?: Record<string, unknown>, pages?: PageConfig[]): PageConfig[] {
  const declared = pages?.filter(p => p.datasetScoped) ?? [];
  const declaredRoutes = new Set(declared.map(p => p.route));

  const result: PageConfig[] = [
    { type: 'custom', route: '', title: 'Concepts', icon: 'list', datasetScoped: true },
  ];
  if (features?.stats !== false && !declaredRoutes.has('stats')) {
    result.push({ type: 'stats', route: 'stats', title: 'Statistics', icon: 'chart', datasetScoped: true });
  }
  if (features?.about !== false && !declaredRoutes.has('about')) {
    result.push({ type: 'about', route: 'about', title: 'About', icon: 'info', datasetScoped: true });
  }

  return [...result, ...declared];
}

export function useSiteConfig() {
  const config = computed(() => siteConfig.value);
  const visibleDatasets = computed(() => siteConfig.value?.datasets ?? []);

  const localizedTitle = computed(() => {
    const tr = siteConfig.value?.translations?.[locale.value];
    return tr?.title ?? siteConfig.value?.title ?? 'Glossarist';
  });

  const localizedSubtitle = computed(() => {
    const tr = siteConfig.value?.translations?.[locale.value];
    return tr?.subtitle ?? siteConfig.value?.subtitle;
  });

  const localizedDescription = computed(() => {
    const tr = siteConfig.value?.translations?.[locale.value];
    return tr?.description ?? siteConfig.value?.description;
  });

  function localizedDatasetField(datasetId: string, field: 'title' | 'description', fallback?: string): string {
    const tr = siteConfig.value?.datasetTranslations?.[datasetId]?.[locale.value];
    return tr?.[field] ?? fallback ?? '';
  }

  const globalPages = computed<PageConfig[]>(() =>
    synthesizeGlobalPages(siteConfig.value?.features, siteConfig.value?.pages),
  );

  const datasetPages = computed<PageConfig[]>(() =>
    synthesizeDatasetPages(siteConfig.value?.features, siteConfig.value?.pages),
  );

  return { config, visibleDatasets, localizedTitle, localizedSubtitle, localizedDescription, localizedDatasetField, loadConfig, globalPages, datasetPages };
}
