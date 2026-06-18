/**
 * Vocabulary prefix helper.
 *
 * The concept-browser JSON-LD corpus uses the `gl:` prefix. glossarist-ruby's
 * `glossarist export` is planned to emit `gloss:` prefix. Until the
 * cross-repo vocabulary issue is resolved (see AUDIT.figures.md §"Open
 * issue: vocabulary prefix"), bridges must accept both prefixes.
 *
 * `pickField` is the single accessor every bridge uses — centralizing the
 * dual-prefix handling here means removing the legacy prefix later is a
 * one-file change.
 */

const PREFIXES = ['gl', 'gloss'] as const;

export function pickField<T = unknown>(
  doc: Record<string, unknown>,
  field: string,
): T | undefined {
  for (const p of PREFIXES) {
    const k = `${p}:${field}`;
    if (doc[k] !== undefined) return doc[k] as T;
  }
  return undefined;
}

export function pickFieldArray<T = unknown>(
  doc: Record<string, unknown>,
  field: string,
): T[] {
  const v = pickField<T[]>(doc, field);
  return Array.isArray(v) ? v : [];
}

export function pickFieldRecord<V = unknown>(
  doc: Record<string, unknown>,
  field: string,
): Record<string, V> | undefined {
  const v = pickField<unknown>(doc, field);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, V>;
  }
  return undefined;
}

export function isType(doc: Record<string, unknown>, typeShort: string): boolean {
  const t = doc['@type'];
  if (typeof t !== 'string') return false;
  for (const p of PREFIXES) {
    if (t === `${p}:${typeShort}`) return true;
  }
  return false;
}

export function localized(doc: Record<string, unknown>, field: string): Record<string, string> | undefined {
  const v = pickField<unknown>(doc, field);
  if (!v) return undefined;
  if (typeof v === 'string') return { eng: v };
  if (typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === 'string') out[k] = val;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}
