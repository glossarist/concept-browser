/**
 * Locale fallback SSOT.
 *
 * Single source of truth for localized text resolution across the runtime.
 * Both the non-verbal entity resolver and any other localized content
 * resolution should call `pickLocaleText` / `pickLocaleMap` rather than
 * implement their own fallback chain.
 */

import { fetchLocalizedString } from 'glossarist';

const DEFAULT_FALLBACK_CHAIN: readonly string[] = ['eng'] as const;

const RTL_LOCALES: ReadonlySet<string> = new Set(['ara', 'heb', 'fas', 'urd', 'arb']);

const ISO_639_2_TO_BCP47: Record<string, string> = {
  eng: 'en', fra: 'fr', deu: 'de', zho: 'zh', ara: 'ar', jpn: 'ja', rus: 'ru',
  kor: 'ko', spa: 'es', ita: 'it', por: 'pt', nld: 'nl', swe: 'sv', fin: 'fi',
  dan: 'da', nob: 'nb', nno: 'nn', nor: 'no', pol: 'pl', tur: 'tr', ces: 'cs', ell: 'el',
  heb: 'he', hin: 'hi', ind: 'id', fas: 'fa', ukr: 'uk', hun: 'hu', ron: 'ro',
  slk: 'sk', slv: 'sl', hrv: 'hr', srp: 'sr', bul: 'bg', msa: 'ms', tha: 'th',
  vie: 'vi', urd: 'ur', ben: 'bn', tam: 'ta', tel: 'te', mar: 'mr', guj: 'gu',
  pan: 'pa', mal: 'ml', kan: 'kn', ori: 'or', asm: 'as', sin: 'si', nep: 'ne',
  lit: 'lt', lav: 'lv', est: 'et', gle: 'ga', cym: 'cy', eus: 'eu', cat: 'ca',
  glg: 'gl', afr: 'af', sqi: 'sq', mkd: 'mk', bel: 'be', kaz: 'kk', uzb: 'uz',
  aze: 'az', hye: 'hy', kat: 'ka', mon: 'mn', tuk: 'tk', uig: 'ug', tgl: 'tl',
};

export type LocalizedText = Record<string, string>;

export interface ResolvedLocaleText {
  locale: string;
  text: string;
}

export function pickLocaleText(
  map: LocalizedText | undefined,
  locale: string,
  fallbackChain: readonly string[] = DEFAULT_FALLBACK_CHAIN,
): string {
  const r = pickLocaleMap(map, locale, fallbackChain);
  return r?.text ?? '';
}

export function pickLocaleMap(
  map: LocalizedText | undefined,
  locale: string,
  fallbackChain: readonly string[] = DEFAULT_FALLBACK_CHAIN,
): ResolvedLocaleText | null {
  if (!map) return null;

  // Disable fetchLocalizedString's built-in 'eng' default by passing null —
  // at runtime `null` defeats the default param and the `!= null` guard
  // inside the lib skips its own fallback. The published .d.ts types the
  // parameter as `string | undefined`, so cast through `unknown`. The chain
  // is owned by THIS module: callers see one predictable resolution order.
  const noFallback = null as unknown as undefined;
  const direct = fetchLocalizedString(map, locale, noFallback);
  if (direct != null) return { locale, text: direct };

  for (const l of fallbackChain) {
    const fb = fetchLocalizedString(map, l, noFallback);
    if (fb != null) return { locale: l, text: fb };
  }

  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  return { locale: entries[0][0], text: entries[0][1] };
}

export function hasLocale(map: LocalizedText | undefined, locale: string): boolean {
  return !!map && Object.prototype.hasOwnProperty.call(map, locale);
}

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.has(locale);
}

export function localeToBcp47(locale: string): string {
  return ISO_639_2_TO_BCP47[locale] ?? locale;
}

export function resolveFallbackChain(datasetLocales?: readonly string[]): readonly string[] {
  if (!datasetLocales || datasetLocales.length === 0) {
    return DEFAULT_FALLBACK_CHAIN;
  }
  const chain = [...datasetLocales];
  for (const l of DEFAULT_FALLBACK_CHAIN) {
    if (!chain.includes(l)) chain.push(l);
  }
  return chain;
}
