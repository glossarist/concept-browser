/**
 * YAML concept harmonization — normalizes multi-doc and simple formats
 * into a single HarmonizedConcept shape.
 *
 * Extracted from generate-data.ts for testability and reuse.
 */

import fs from 'fs';
import yaml from 'js-yaml';
import type { HarmonizedConcept, YamlManagedConceptDoc } from './yaml-types';

export const LEGACY_MULTIPLICITY_MAP: Record<string, { presence: string; count: string }> = {
  compulsory:               { presence: 'required', count: 'exactly_one' },
  optional:                 { presence: 'optional', count: 'exactly_one' },
  compulsory_multiple:      { presence: 'required', count: 'multiple' },
  optional_multiple:        { presence: 'optional', count: 'multiple' },
  compulsory_at_least_one:  { presence: 'required', count: 'at_least_one' },
};

export const LEGACY_CERTAINTY_FROM_AXIS: Record<string, string> = {
  required: 'confirmed',
  optional: 'possible',
};

export function splitMultiplicity(multiplicity: string): { presence: string; count: string } {
  return multiplicity in LEGACY_MULTIPLICITY_MAP
    ? LEGACY_MULTIPLICITY_MAP[multiplicity]
    : { presence: 'required', count: 'exactly_one' };
}

export function loadConceptFile(filePath: string): HarmonizedConcept {
  const content = fs.readFileSync(filePath, 'utf8');
  const docs = yaml.loadAll(content, null, { schema: yaml.DEFAULT_SCHEMA }) as Record<string, any>[];

  if (docs.length === 1 && docs[0].termid !== undefined) {
    return docs[0] as HarmonizedConcept;
  }

  if (docs.length >= 1 && docs[0].data && docs[0].data.identifier !== undefined) {
    const mc = docs[0] as YamlManagedConceptDoc;
    const result: HarmonizedConcept = { termid: String(mc.data!.identifier) };

    if (mc.related) result._related = mc.related as any;
    if (mc.partitive_relations) result._partitiveRelations = mc.partitive_relations as any;
    if (mc.generic_relations) result._genericRelations = mc.generic_relations as any;
    if (mc.data!.domains) result._domains = mc.data!.domains;
    if (mc.dates) result._dates = mc.dates as any;
    if (mc.sources) result._sources = mc.sources as any;
    if (mc.status) result._status = mc.status;
    if (mc.schema_version) result._schemaVersion = mc.schema_version;
    if (mc.date_accepted) result._dateAccepted = mc.date_accepted;

    const MERGE_KEYS = [
      'terms', 'definition', 'notes', 'annotations', 'examples', 'sources',
      'dates', 'domain', 'references', 'entry_status', 'classification',
      'review_type', 'review_date', 'review_decision_date', 'review_decision_event',
      'review_status', 'review_decision', 'review_decision_notes',
      'lineage_source_similarity', 'release', 'script', 'system',
    ];

    for (const doc of docs.slice(1)) {
      if (!doc) continue;
      const lang = doc.data?.language_code || doc.language_code;
      if (!lang) continue;
      const lcData = { ...(doc.data || {}) };
      delete lcData.language_code;
      for (const key of MERGE_KEYS) {
        if (doc[key] !== undefined && lcData[key] === undefined) {
          lcData[key] = doc[key];
        }
      }
      (result as Record<string, any>)[lang] = lcData;
    }
    return result;
  }

  return docs[0] as HarmonizedConcept;
}

export function readYaml(filePath: string): any {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
