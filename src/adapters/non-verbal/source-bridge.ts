/**
 * Source bridge — converts JSON-LD source entries to NonVerbalSource.
 *
 * Shared by Figure, Table, Formula bridges (all three use the same source
 * shape, mirroring glossarist's ConceptSource). One function, one shape.
 */

import type { NonVerbalSource, NonVerbalSourceOrigin, NonVerbalSourceRef, NonVerbalSourceLocality } from './types';
import { pickField } from './prefix';

function refFromJsonLd(raw: Record<string, unknown> | string | undefined): NonVerbalSourceRef | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return { source: raw };
  const r: NonVerbalSourceRef = {};
  const source = pickField<string>(raw, 'source');
  const id = pickField<string>(raw, 'id');
  const version = pickField<string>(raw, 'version');
  const text = pickField<string>(raw, 'text');
  if (source) r.source = source;
  if (id) r.id = id;
  if (version) r.version = version;
  if (text) r.text = text;
  return Object.keys(r).length ? r : undefined;
}

function localityFromJsonLd(raw: Record<string, unknown> | undefined): NonVerbalSourceLocality | undefined {
  if (!raw) return undefined;
  const out: NonVerbalSourceLocality = {};
  const t = pickField<string>(raw, 'localityType') ?? (raw.type as string | undefined);
  const rf = pickField<string>(raw, 'referenceFrom') ?? (raw.reference_from as string | undefined);
  const rt = pickField<string>(raw, 'referenceTo') ?? (raw.reference_to as string | undefined);
  if (t) out.type = t;
  if (rf) out.referenceFrom = rf;
  if (rt) out.referenceTo = rt;
  return Object.keys(out).length ? out : undefined;
}

function originFromJsonLd(raw: Record<string, unknown> | undefined): NonVerbalSourceOrigin | undefined {
  if (!raw) return undefined;
  const out: NonVerbalSourceOrigin = {};
  const ref = refFromJsonLd(pickField<Record<string, unknown>>(raw, 'ref'));
  const locality = localityFromJsonLd(pickField<Record<string, unknown>>(raw, 'locality'));
  const link = pickField<string>(raw, 'link');
  const id = pickField<string>(raw, 'id');
  const version = pickField<string>(raw, 'version');
  const source = pickField<string>(raw, 'source');
  if (ref) out.ref = ref;
  if (locality) out.locality = locality;
  if (link) out.link = link;
  if (id) out.id = id;
  if (version) out.version = version;
  if (source) out.source = source;
  return Object.keys(out).length ? out : undefined;
}

export function sourceFromJsonLd(raw: Record<string, unknown> | undefined): NonVerbalSource | undefined {
  if (!raw) return undefined;
  const out: NonVerbalSource = {};
  const id = pickField<string>(raw, 'id');
  const type = pickField<string>(raw, 'sourceType') ?? pickField<string>(raw, 'type');
  const status = pickField<string>(raw, 'sourceStatus') ?? pickField<string>(raw, 'status');
  const modification = pickField<string>(raw, 'modification');
  const origin = originFromJsonLd(pickField<Record<string, unknown>>(raw, 'origin'));
  if (id) out.id = id;
  if (type) out.type = type;
  if (status) out.status = status;
  if (modification) out.modification = modification;
  if (origin) out.origin = origin;
  return Object.keys(out).length ? out : undefined;
}

export function sourcesFromJsonLd(raw: unknown): NonVerbalSource[] {
  if (!Array.isArray(raw)) return [];
  const out: NonVerbalSource[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const s = sourceFromJsonLd(entry as Record<string, unknown>);
    if (s) out.push(s);
  }
  return out;
}
