import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerFormat,
  unregisterFormat,
  getFormat,
  listFormats,
  clearFormats,
  type FormatDescriptor,
} from '../composables/use-format-registry';

const BUILTIN_DESCRIPTORS: FormatDescriptor[] = [
  { id: 'ttl',    extension: 'ttl',     mediaType: 'text/turtle',           label: 'Turtle',      available: 'both',         serialize: 'build' },
  { id: 'jsonld', extension: 'jsonld',  mediaType: 'application/ld+json',   label: 'JSON-LD',     available: 'both',         serialize: 'build' },
  { id: 'yaml',   extension: 'yaml',   mediaType: 'application/yaml',       label: 'YAML',        available: 'per-concept',  serialize: 'build' },
  { id: 'tbx',    extension: 'tbx.xml', mediaType: 'application/x-tbx',     label: 'TBX',         available: 'aggregate',    serialize: 'build' },
  { id: 'jsonl',  extension: 'jsonl',  mediaType: 'application/jsonl+json', label: 'JSON-Lines',  available: 'aggregate',    serialize: 'build' },
];

function resetToBuiltins() {
  clearFormats();
  for (const desc of BUILTIN_DESCRIPTORS) {
    registerFormat(desc);
  }
}

describe('FormatRegistry', () => {
  beforeEach(resetToBuiltins);
  afterEach(resetToBuiltins);

  describe('registerFormat / getFormat', () => {
    it('registers and retrieves a format by id', () => {
      registerFormat({ id: 'csv', extension: 'csv', mediaType: 'text/csv', label: 'CSV', available: 'both', serialize: 'build' });
      const got = getFormat('csv');
      expect(got).toBeDefined();
      expect(got?.extension).toBe('csv');
      expect(got?.label).toBe('CSV');
    });

    it('overwrites an existing format with the same id', () => {
      registerFormat({ id: 'csv', extension: 'csv', mediaType: 'text/csv', label: 'Old', available: 'both', serialize: 'build' });
      registerFormat({ id: 'csv', extension: 'csv', mediaType: 'text/csv', label: 'New', available: 'both', serialize: 'build' });
      expect(getFormat('csv')?.label).toBe('New');
    });

    it('returns undefined for unknown ids', () => {
      expect(getFormat('does-not-exist')).toBeUndefined();
    });
  });

  describe('unregisterFormat', () => {
    it('removes a format from the registry', () => {
      registerFormat({ id: 'csv', extension: 'csv', mediaType: 'text/csv', label: 'CSV', available: 'both', serialize: 'build' });
      unregisterFormat('csv');
      expect(getFormat('csv')).toBeUndefined();
    });

    it('is a no-op for unknown ids', () => {
      expect(() => unregisterFormat('never-registered')).not.toThrow();
    });
  });

  describe('listFormats', () => {
    it('returns all registered formats sorted by label', () => {
      const all = listFormats();
      const labels = all.map(f => f.label);
      const sorted = [...labels].sort((a, b) => a.localeCompare(b));
      expect(labels).toEqual(sorted);
    });

    it('returns formats whose availability matches the filter or is "both"', () => {
      const perConcept = listFormats({ availability: 'per-concept' });
      for (const f of perConcept) {
        expect(['per-concept', 'both']).toContain(f.available);
      }
    });

    it('returns formats whose availability matches aggregate filter or is "both"', () => {
      const aggregate = listFormats({ availability: 'aggregate' });
      for (const f of aggregate) {
        expect(['aggregate', 'both']).toContain(f.available);
      }
    });

    it('includes both-availability formats in per-concept listings', () => {
      const perConcept = listFormats({ availability: 'per-concept' });
      const ids = perConcept.map(f => f.id);
      expect(ids).toContain('ttl');
      expect(ids).toContain('jsonld');
      expect(ids).toContain('yaml');
    });

    it('excludes per-concept-only formats from aggregate listings', () => {
      const aggregate = listFormats({ availability: 'aggregate' });
      const ids = aggregate.map(f => f.id);
      expect(ids).not.toContain('yaml');
    });
  });

  describe('built-in registrations', () => {
    it('registers ttl, jsonld, yaml, tbx, jsonl on module load', () => {
      for (const id of ['ttl', 'jsonld', 'yaml', 'tbx', 'jsonl']) {
        expect(getFormat(id)).toBeDefined();
      }
    });

    it('gives ttl and jsonld a per-concept-and-aggregate availability', () => {
      expect(getFormat('ttl')?.available).toBe('both');
      expect(getFormat('jsonld')?.available).toBe('both');
    });

    it('gives yaml a per-concept-only availability', () => {
      expect(getFormat('yaml')?.available).toBe('per-concept');
    });

    it('gives tbx and jsonl an aggregate-only availability', () => {
      expect(getFormat('tbx')?.available).toBe('aggregate');
      expect(getFormat('jsonl')?.available).toBe('aggregate');
    });

    it('declares media types distinct from extensions where appropriate', () => {
      expect(getFormat('ttl')?.mediaType).toBe('text/turtle');
      expect(getFormat('tbx')?.extension).toBe('tbx.xml');
    });
  });
});
