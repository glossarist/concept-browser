// Type shim for the .mjs script — vitest needs declared types.
// The actual functions are imported by value (see below).
declare module '../../../scripts/migrate-v1-to-v3.mjs' {
  export function isV1PartitiveRelation(rel: unknown): boolean;
  export function migrateRelation(rel: unknown): unknown;
  export function migrateConceptData(data: unknown): unknown;
  export function isAlreadyMigrated(content: unknown): boolean;
}
