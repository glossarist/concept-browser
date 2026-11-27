/**
 * DatasetCuration — wire shape of `{register}/curation.json`, emitted
 * by scripts/generate-data.ts (issue #260). Single source of truth for
 * the curation-queues UI.
 */

export interface CurationQueueItem {
  id: string;
  designation: string;
  reason?: string;
  missing?: string[];
}

export interface CurationQueue {
  count: number;
  items: CurationQueueItem[];
}

export interface DatasetCuration {
  registerId: string;
  conceptCount: number;
  languages: string[];
  validation: CurationQueue;
  missingTranslations: CurationQueue;
  noSources: CurationQueue;
}
