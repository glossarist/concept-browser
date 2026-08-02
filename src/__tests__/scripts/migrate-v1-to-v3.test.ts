import { describe, it, expect } from 'vitest';
// .mjs scripts have no type declarations. The .d.mts shim provides them.
import {
  isV1PartitiveRelation,
  migrateRelation,
  migrateConceptData,
  isAlreadyMigrated,
} from '../../../scripts/migrate-v1-to-v3';

describe('migrate-v1-to-v3 pure conversion', () => {
  describe('isV1PartitiveRelation', () => {
    it('returns true for v1 shape (has parts array)', () => {
      expect(isV1PartitiveRelation({ comprehensive: {}, parts: [] })).toBe(true);
    });

    it('returns false for v3 shape (has partitives array)', () => {
      expect(isV1PartitiveRelation({ comprehensive: {}, partitives: [] })).toBe(false);
    });

    it('returns falsy for null/undefined', () => {
      expect(isV1PartitiveRelation(null)).toBeFalsy();
      expect(isV1PartitiveRelation(undefined)).toBeFalsy();
    });
  });

  describe('migrateRelation', () => {
    it('converts v1 → v3 fields', () => {
      const v1 = {
        comprehensive: { source: 'urn:test', id: '1.3' },
        parts: [
          { source: 'urn:test', id: '1.4' },
          { source: 'urn:test', id: '1.5' },
        ],
        enumeration: 'closed',
      };
      const v3 = migrateRelation(v1) as null | { comprehensive: { source: string; id: string }; completeness: string; partitives: Array<{ ref: { source: string; id: string }; certainty: string }> };
      expect(v3).not.toBeNull();
      expect(v3!.comprehensive).toEqual({ source: 'urn:test', id: '1.3' });
      expect(v3!.completeness).toBe('complete');
      expect(v3!.partitives).toHaveLength(2);
      expect(v3!.partitives[0].ref).toEqual({ source: 'urn:test', id: '1.4' });
      expect(v3!.partitives[1].ref).toEqual({ source: 'urn:test', id: '1.5' });
    });

    it('maps v1 enumeration: open → v3 completeness: partial', () => {
      const v3 = migrateRelation({
        comprehensive: { source: 'urn:test', id: '1.3' },
        parts: [{ source: 'urn:test', id: '1.4' }, { source: 'urn:test', id: '1.5' }],
        enumeration: 'open',
      }) as null | { completeness: string };
      expect(v3).not.toBeNull();
      expect(v3!.completeness).toBe('partial');
    });

    it('drops v1 markers (multiplicity carries that info now)', () => {
      const v3 = migrateRelation({
        comprehensive: {}, parts: [{ source: 'x', id: 'a' }, { source: 'x', id: 'b' }],
        markers: ['double', 'dashed'],
      });
      expect(v3).not.toHaveProperty('markers');
    });

    it('preserves v1 content if present (forward-compat)', () => {
      const v3 = migrateRelation({
        comprehensive: {}, parts: [{ source: 'x', id: 'a' }, { source: 'x', id: 'b' }],
        content: 'some prose',
      }) as null | { content?: string };
      expect(v3).not.toBeNull();
      expect(v3!.content).toBe('some prose');
    });

    it('returns null for already-migrated relation (v3 shape)', () => {
      expect(migrateRelation({
        comprehensive: {},
        partitives: [{ ref: {}, certainty: 'confirmed' }],
      })).toBeNull();
    });
  });

  describe('migrateConceptData', () => {
    it('returns null for empty partitive_relations', () => {
      expect(migrateConceptData({ partitive_relations: [] })).toBeNull();
    });

    it('migrates a concept with multiple relations', () => {
      const v1Data = {
        other_field: 'preserved',
        partitive_relations: [
          { comprehensive: {}, parts: [{ source: 'x', id: 'a' }, { source: 'x', id: 'b' }] },
          { comprehensive: {}, parts: [{ source: 'x', id: 'c' }, { source: 'x', id: 'd' }] },
        ],
      };
      const v3 = migrateConceptData(v1Data) as null | { other_field: string; partitive_relations: Array<{ partitives: Array<{ ref: { source: string; id: string } }> }> };
      expect(v3!.other_field).toBe('preserved');
      expect(v3!.partitive_relations).toHaveLength(2);
      expect(v3!.partitive_relations[0].partitives[0].ref).toEqual({ source: 'x', id: 'a' });
      expect(v3!.partitive_relations[1].partitives[1].ref).toEqual({ source: 'x', id: 'd' });
    });
  });

  describe('isAlreadyMigrated', () => {
    it('detects v3 (partitives array present)', () => {
      expect(isAlreadyMigrated({ data: { partitive_relations: [{ partitives: [] }] } })).toBe(true);
    });

    it('returns false for v1 (parts but no partitives)', () => {
      expect(isAlreadyMigrated({ data: { partitive_relations: [{ parts: [] }] } })).toBe(false);
    });

    it('returns false for empty data', () => {
      expect(isAlreadyMigrated({ data: {} })).toBe(false);
      expect(isAlreadyMigrated(null)).toBe(false);
    });
  });
});
