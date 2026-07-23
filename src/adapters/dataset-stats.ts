/**
 * Dataset-level stats shape. The data pipeline emits this as
 * `public/data/{registerId}/stats.json`. Consumers fetch via HTTP.
 *
 * Kept in adapters/types.ts (the SSOT for wire shapes) so all views
 * that need stats share the same definition.
 */
export interface DatasetStats {
  sourceCount: number;
  sources: Array<{ ref: string; types: string[]; conceptCount: number }>;
  relationshipCount: number;
  relationshipTypes: Record<string, number>;
}
