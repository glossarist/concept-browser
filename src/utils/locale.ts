/**
 * Locale fallback SSOT.
 *
 * Single source of truth for localized text resolution across the runtime.
 * Both the non-verbal entity resolver and any other localized content
 * resolution should call `pickLocaleText` / `pickLocaleMap` rather than
 * implement their own fallback chain.
 *
 * Language-code mapping (ISO 639-3 ↔ ISO 639-1) and BCP-47 parsing live in
 * `./bcp47`; this module re-exports the mapping for backwards
 * compatibility.
 */

import { fetchLocalizedString } from 'glossarist';
import { mapIso6393To6391 } from './bcp47';

const DEFAULT_FALLBACK_CHAIN: readonly string[] = ['eng'] as const;

const RTL_LOCALES: ReadonlySet<string> = new Set(['ara', 'heb', 'fas', 'urd', 'arb']);

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
  return mapIso6393To6391(locale) ?? locale;
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
