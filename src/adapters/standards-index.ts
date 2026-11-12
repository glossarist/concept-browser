/** Per-register standards.json, keyed by the normalized cited-standard identity. */
export type StandardsIndex = Record<string, {
  /** Normalized display label from the first authoritative citation encountered. */
  label: string;
  /** Unique concept IDs in dataset encounter order. */
  conceptIds: string[];
}>;
