// Type declarations for the .mjs script — vitest needs a typed surface.
// The actual implementations are imported by value from the script.
export function isV1PartitiveRelation(rel: unknown): boolean;
export function migrateRelation(rel: unknown): Record<string, unknown> | null;
export function migrateConceptData(data: Record<string, unknown> | null | undefined): Record<string, unknown> | null;
export function isAlreadyMigrated(content: unknown): boolean;
