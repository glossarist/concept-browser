import { ref, computed } from 'vue';
import type { PageConfig, SiteColors } from './types';
import type { DatasetGroup } from './types';
import { synthesizePages } from './page-types';
import { locale } from '../i18n';
import { fontStack, DEFAULT_FONTS, DEFAULT_CATEGORY } from '../utils/font-stack';

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
  datasetGroups?: DatasetGroup[];
  defaultDataset?: string;
  uiLanguages?: { code: string; label: string }[];
  branding?: {
    primaryColor?: string;
    darkColor?: string;
    fonts?: {
      title?: { family: string; source: string; weights?: number[]; url?: string; category?: 'serif' | 'sans-serif' | 'monospace' };
      heading?: { family: string; source: string; weights?: number[]; url?: string; category?: 'serif' | 'sans-serif' | 'monospace' };
      header?: { family: string; source: string; weights?: number[]; url?: string; category?: 'serif' | 'sans-serif' | 'monospace' }; // deprecated alias for heading
      body?: { family: string; source: string; weights?: number[]; url?: string; category?: 'serif' | 'sans-serif' | 'monospace' };
      mono?: { family: string; source: string; weights?: number[]; url?: string; category?: 'serif' | 'sans-serif' | 'monospace' };
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
  colors?: SiteColors;
}

const siteConfig = ref<RuntimeSiteConfig | null>(null);
const loaded = ref(false);

function loadFont(font: { family: string; source: string; weights?: number[]; url?: string }) {
  if (font.source === 'google') {
    const familySlug = font.family.replace(/ /g, '+');
    // Match by family name substring — build-time HTML uses combined URLs
    if (document.querySelector(`link[href*="family=${familySlug}"]`)) return;

    const w = (font.weights || [400, 700]).join(';');
    const href = `https://fonts.googleapis.com/css2?family=${familySlug}:wght@${w}&display=swap`;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = () => { link.rel = 'stylesheet'; };
    document.head.appendChild(link);
  }
  if (font.source === 'url' && font.url) {
    const existing = document.querySelector(`link[href="${font.url}"]`);
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = font.url;
    link.onload = () => { link.rel = 'stylesheet'; };
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

  if (b.fonts?.title) {
    loadFont(b.fonts.title);
    root.style.setProperty('--font-title', fontStack(b.fonts.title, DEFAULT_CATEGORY.title) ?? DEFAULT_FONTS.title);
  }
  // heading is the new slot name; header is the backward-compat alias.
  const headingFont = b.fonts?.heading ?? b.fonts?.header;
  if (headingFont) {
    loadFont(headingFont);
    const stack = fontStack(headingFont, DEFAULT_CATEGORY.heading) ?? DEFAULT_FONTS.heading;
    root.style.setProperty('--font-heading', stack);
    root.style.setProperty('--font-header', stack);
  }
  if (b.fonts?.body) {
    loadFont(b.fonts.body);
    root.style.setProperty('--font-body', fontStack(b.fonts.body, DEFAULT_CATEGORY.body) ?? DEFAULT_FONTS.body);
  }
  if (b.fonts?.mono) {
    loadFont(b.fonts.mono);
    root.style.setProperty('--font-mono', fontStack(b.fonts.mono, DEFAULT_CATEGORY.mono) ?? DEFAULT_FONTS.mono);
  }
}

async function loadConfig(): Promise<RuntimeSiteConfig | null> {
  if (loaded.value) return siteConfig.value;
  try {
    const inline = document.getElementById('site-config-json');
    if (inline?.textContent) {
      siteConfig.value = JSON.parse(inline.textContent);
    } else {
      const resp = await fetch(`${import.meta.env.BASE_URL}site-config.json`);
      if (resp.ok) {
        siteConfig.value = await resp.json();
      }
    }
    if (siteConfig.value) applyBranding(siteConfig.value);
  } catch {
    // Non-critical
  }
  loaded.value = true;
  return siteConfig.value;
}

function synthesizeGlobalPages(features?: Record<string, unknown>, pages?: PageConfig[]): PageConfig[] {
  const declared = pages?.filter(p => !p.datasetScoped) ?? [];
  const declaredRoutes = new Set(declared.map(p => p.route));

  const synthesized = synthesizePages('global', features, declaredRoutes)
    .map(p => ({ type: p.type, route: p.route, title: p.title, icon: p.icon }));

  return [...synthesized, ...declared];
}

function synthesizeDatasetPages(features?: Record<string, unknown>, pages?: PageConfig[]): PageConfig[] {
  const declared = pages?.filter(p => p.datasetScoped) ?? [];
  const declaredRoutes = new Set(declared.map(p => p.route));

  const synthesized = synthesizePages('dataset', features, declaredRoutes)
    .map(p => ({
      type: p.type,
      route: p.route,
      title: p.title,
      icon: p.icon,
      datasetScoped: true as const,
    }));

  return [...synthesized, ...declared];
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

  return { config, visibleDatasets, localizedTitle, localizedSubtitle, localizedDescription, localizedDatasetField, loadConfig, globalPages, datasetPages, datasetGroups: computed(() => siteConfig.value?.datasetGroups) };
}
