/**
 * useConceptDiff — diff two concepts and derive render-ready sections.
 *
 * Consolidates logic that was previously duplicated across
 * ConceptDiffIsland.vue and SupersessionDiffIsland.vue (DRY).
 *
 * Pipeline:
 *   raw wire data → DiffableConcept → diffConcepts → ConceptDiff
 *                                                   ↓
 *                                               deriveDiffSections
 *                                               computeSimilarity
 *
 * `similarity` is not a field on ConceptDiff (it doesn't exist in
 * glossarist-js's type). It is computed from stats:
 *   similarity = 1 - (added + removed + changed) / total
 */

import { ref } from 'vue';
import { diffConcepts } from 'glossarist/diff';
import type { ConceptDiff } from 'glossarist/diff';

// ── Inputs ────────────────────────────────────────────────────────────────

/** Wire shape of a concept as stored in fetched JSON or content collections. */
export interface ConceptLikeData {
  conceptId?: string;
  id?: string;
  uri?: string;
  status?: string;
  languages?: string[];
  localizations?: Record<string, unknown>;
}

/** Normalized concept shape consumed by diffConcepts. */
export interface DiffableConcept {
  readonly id: string;
  readonly termid: string;
  readonly status?: string;
  readonly uri?: string;
  readonly languages: readonly string[];
  localization(lang: string): {
    languageCode: string;
    terms: unknown[];
    definitions: unknown[];
    notes: unknown[];
    examples: unknown[];
  } | null;
}

// ── Outputs ───────────────────────────────────────────────────────────────

export type DiffHunk = { type: 'added' | 'removed' | 'equal'; text: string };

export interface DefinitionDiff {
  hunks?: readonly DiffHunk[];
  type?: 'added' | 'removed';
  value?: string;
}

export interface DesignationsDiff {
  items: Array<{ type?: string; text: string }>;
}

export interface SimpleChangesDiff {
  items: Array<{ type?: string; text: string }>;
}

export interface DiffSections {
  definition?: DefinitionDiff;
  designations?: DesignationsDiff;
  terms?: { hunks?: readonly DiffHunk[]; oldValue?: string; newValue?: string };
  notes?: SimpleChangesDiff;
  examples?: SimpleChangesDiff;
}

// ── Adapters ──────────────────────────────────────────────────────────────

export function toDiffableConcept(data: ConceptLikeData): DiffableConcept {
  const langs = data.languages
    ?? (data.localizations ? Object.keys(data.localizations) : []);
  const id = String(data.conceptId ?? data.id ?? '');
  return {
    id,
    termid: id,
    status: data.status,
    uri: data.uri,
    languages: langs,
    localization(lang: string) {
      const locs = (data.localizations ?? {}) as Record<string, any>;
      const loc = locs[lang];
      if (!loc) return null;
      return {
        languageCode: loc.languageCode ?? lang,
        terms: loc.terms ?? [],
        definitions: loc.definitions ?? [],
        notes: loc.notes ?? [],
        examples: loc.examples ?? [],
      };
    },
  };
}

// ── Pure derivations ──────────────────────────────────────────────────────

interface ReadableConceptDiff {
  localization?(lang: string): any;
  localizations?: Record<string, any>;
  stats?: { added?: number; removed?: number; changed?: number; total?: number };
}

function asReadable(diff: ConceptDiff): ReadableConceptDiff {
  return diff as unknown as ReadableConceptDiff;
}

function extractDesignationText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value.designation ?? value.text ?? String(value);
}

function extractContentText(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value.content ?? value.text ?? String(value);
}

/**
 * Derive render-ready DiffSections from a ConceptDiff for a single language.
 * Pure function — same diff + lang always yields the same sections.
 */
export function deriveDiffSections(diff: ConceptDiff | null, lang: string): DiffSections {
  if (!diff) return {};
  const d = asReadable(diff);
  const loc = d.localization?.(lang) ?? d.localizations?.[lang];
  if (!loc) return {};
  const out: DiffSections = {};

  const defChanged = loc.definitions?.changed?.[0];
  if (defChanged?.textDiff?.hunks?.length) {
    out.definition = { hunks: defChanged.textDiff.hunks };
  } else if (loc.definitions?.added?.length) {
    out.definition = { type: 'added', value: extractContentText(loc.definitions.added[0].value) };
  } else if (loc.definitions?.removed?.length) {
    out.definition = { type: 'removed', value: extractContentText(loc.definitions.removed[0].value) };
  }

  const hasDesignationChanges =
    loc.designations?.added?.length
    || loc.designations?.removed?.length
    || loc.designations?.changed?.length;
  if (hasDesignationChanges) {
    const items: Array<{ type?: string; text: string }> = [];
    for (const d of loc.designations.added ?? []) {
      items.push({ type: 'added', text: extractDesignationText(d.value) });
    }
    for (const d of loc.designations.removed ?? []) {
      items.push({ type: 'removed', text: extractDesignationText(d.value) });
    }
    for (const d of loc.designations.changed ?? []) {
      items.push({ type: 'removed', text: extractDesignationText(d.oldValue) });
      items.push({ type: 'added', text: extractDesignationText(d.newValue) });
    }
    out.designations = { items };
  }

  if (loc.notes?.added?.length || loc.notes?.removed?.length) {
    out.notes = {
      items: [
        ...(loc.notes.added ?? []).map((n: any) => ({ type: 'added', text: extractContentText(n.value) })),
        ...(loc.notes.removed ?? []).map((n: any) => ({ type: 'removed', text: extractContentText(n.value) })),
      ],
    };
  }

  if (loc.examples?.added?.length || loc.examples?.removed?.length) {
    out.examples = {
      items: [
        ...(loc.examples.added ?? []).map((e: any) => ({ type: 'added', text: extractContentText(e.value) })),
        ...(loc.examples.removed ?? []).map((e: any) => ({ type: 'removed', text: extractContentText(e.value) })),
      ],
    };
  }

  return out;
}

/**
 * Similarity score in [0, 1]. Returns null when no comparable stats.
 *
 * Computed as 1 − (added + removed + changed) / total — i.e. the
 * fraction of the concept that did NOT change. `added` counts as a
 * change because it represents content present in only one version.
 */
export function computeSimilarity(diff: ConceptDiff | null): number | null {
  if (!diff) return null;
  const stats = asReadable(diff).stats;
  if (!stats || !stats.total) return null;
  const changed = (stats.added ?? 0) + (stats.removed ?? 0) + (stats.changed ?? 0);
  return Math.max(0, Math.min(1, 1 - changed / stats.total));
}

// ── Composable ────────────────────────────────────────────────────────────

export function useConceptDiff() {
  const diffResult = ref<ConceptDiff | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function diff(oldData: ConceptLikeData | null, newData: ConceptLikeData | null): void {
    loading.value = true;
    error.value = null;
    try {
      diffResult.value = diffConcepts(
        oldData ? toDiffableConcept(oldData) : null,
        newData ? toDiffableConcept(newData) : null,
      );
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      diffResult.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    diffResult.value = null;
    error.value = null;
  }

  return { diffResult, loading, error, diff, clear };
}
