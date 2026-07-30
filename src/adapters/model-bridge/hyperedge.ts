/**
 * Hyperedge (n-ary relation) mapping: JSON-LD → glossarist-js model.
 *
 * Handles ISO 704:2022 n-ary relations — both PartitiveHyperedge and
 * GenericHyperedge share the same JSON-LD wire shape. The mapper is
 * identical for both; the glossarist-js Concept constructor dispatches
 * by wire key (`partitive_relations` vs `generic_relations`).
 *
 * MECE migration: reads presence × count directly (ISO 704:2022 v3).
 * Falls back to migrating the legacy 5-value `multiplicity` or v2
 * `certainty` field.
 */
import { GL } from '../wire-keys';
import { isPartitivePresence, isPartitiveCount } from '../../utils/partitive-multiplicity';
import { mapRefFromJsonLd } from './mappers';
import type { JsonLdPartitiveRelation } from './jsonld-types';

/**
 * Map a JSON-LD relation entry to the raw dict shape that
 * glossarist-js's AbstractHyperedge subclasses accept.
 *
 * Works for both PartitiveHyperedge and GenericHyperedge — the only
 * difference at the wire level is which wire key the parent dict
 * uses (`partitive_relations` vs `generic_relations`).
 *
 * Reads `gl:hasPartitive`, `gl:hasGeneric`, or `gl:members` for
 * the member array (in order of preference).
 */
export function mapHyperedgeFromJsonLd(
  r: JsonLdPartitiveRelation,
  memberKey: 'gl:hasPartitive' | 'gl:hasGeneric' | 'gl:members' = 'gl:hasPartitive',
): Record<string, unknown> | null {
  const comprehensive = r[GL.COMPREHENSIVE] ? mapRefFromJsonLd(r[GL.COMPREHENSIVE]) : null;
  if (!comprehensive) return null;

  const rawMembers = r[GL.HAS_PARTITIVE] ?? r[GL.HAS_GENERIC] ?? r[GL.HAS_MEMBER] ?? r[memberKey] ?? [];
  const partitives = (rawMembers as any[])
    .map((m): Record<string, unknown> | null => {
      const ref = m[GL.REF] ? mapRefFromJsonLd(m[GL.REF]) : null;
      if (!ref) return null;
      const out: Record<string, unknown> = { ref };
      const presence = m[GL.PRESENCE];
      const count = m[GL.COUNT];
      if (isPartitivePresence(presence) && isPartitiveCount(count)) {
        out.presence = presence;
        out.count = count;
      } else {
        const raw = m[GL.MULTIPLICITY] ?? splitLegacyCertainty(m[GL.CERTAINTY]);
        if (raw) {
          const parts = splitMultiplicity(raw);
          out.presence = parts.presence;
          out.count = parts.count;
        }
      }
      if (m[GL.IS_DELIMITING] === true) out.is_delimiting = true;
      // ISO 704:2022 §5.5.4.2.1 — GenericMember carries a required
      // delimitingCharacteristic (the intension difference between
      // this specific concept and its coordinate concepts).
      const dc = m[GL.DELIMITING_CHARACTERISTIC];
      if (dc) {
        out.delimitingCharacteristic = typeof dc === 'string'
          ? { default: dc }
          : dc;
      }
      return out;
    })
    .filter((m): m is Record<string, unknown> => m !== null);

  if (partitives.length < 2) return null;

  const out: Record<string, unknown> = {
    comprehensive,
    members: partitives,
  };

  if (r[GL.COMPLETENESS]) out.completeness = r[GL.COMPLETENESS];

  if (r[GL.CRITERION]) {
    out.criterion = typeof r[GL.CRITERION] === 'string'
      ? { default: r[GL.CRITERION] }
      : r[GL.CRITERION];
  }

  return out;
}

/** Migrate legacy v2 certainty → old v3 multiplicity string. */
function splitLegacyCertainty(certainty: string | undefined): string | null {
  if (!certainty) return null;
  return certainty === 'possible' ? 'optional' : 'compulsory';
}

/** Split the legacy one-string multiplicity into MECE presence × count. */
function splitMultiplicity(m: string): { presence: 'required' | 'optional'; count: 'exactly_one' | 'at_least_one' | 'multiple' } {
  const LEGACY_MAP: Record<string, { presence: 'required' | 'optional'; count: 'exactly_one' | 'at_least_one' | 'multiple' }> = {
    compulsory:               { presence: 'required', count: 'exactly_one' },
    optional:                 { presence: 'optional', count: 'exactly_one' },
    compulsory_multiple:      { presence: 'required', count: 'multiple' },
    optional_multiple:        { presence: 'optional', count: 'multiple' },
    compulsory_at_least_one:  { presence: 'required', count: 'at_least_one' },
  };
  return LEGACY_MAP[m] ?? { presence: 'required', count: 'exactly_one' };
}
