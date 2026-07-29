/**
 * Partitive relation mapping: JSON-LD → glossarist-js PartitiveRelation.
 *
 * Handles ISO 704:2022 MECE axes (presence × count) plus legacy
 * migration from the 5-value `multiplicity` enum and the 2-value
 * `certainty` field. See BRIDGES.md for the migration contract.
 */
import { GL } from '../wire-keys';
import { isPartitivePresence, isPartitiveCount } from '../../utils/partitive-multiplicity';
import { mapRefFromJsonLd } from './mappers';
import type { JsonLdPartitiveRelation } from './jsonld-types';

export function mapPartitiveRelationFromJsonLd(r: JsonLdPartitiveRelation): Record<string, unknown> | null {
  const comprehensive = r[GL.COMPREHENSIVE] ? mapRefFromJsonLd(r[GL.COMPREHENSIVE]) : null;
  if (!comprehensive) return null;

  const partitives = (r[GL.HAS_PARTITIVE] ?? [])
    .map((m): Record<string, unknown> | null => {
      const ref = m[GL.REF] ? mapRefFromJsonLd(m[GL.REF]) : null;
      if (!ref) return null;
      const out: Record<string, unknown> = { ref };
      // ISO 704:2022 MECE: prefer presence × count from JSON-LD. Fall back
      // to migrating the legacy one-string `multiplicity` or v2 `certainty`
      // so data in transit from older glossarist versions still loads.
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
      return out;
    })
    .filter((m): m is Record<string, unknown> => m !== null);

  // ISO 704 requires ≥2 partitives. Skip malformed relations rather
  // than letting the constructor throw and break the whole concept.
  if (partitives.length < 2) return null;

  const out: Record<string, unknown> = {
    comprehensive,
    partitives,
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
