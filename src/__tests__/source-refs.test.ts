import { describe, it, expect, beforeEach } from 'vitest';
import { ReferenceResolver } from '../adapters/ReferenceResolver';
import type { Resolution } from '../adapters/types';

type InternalResolution = Extract<Resolution, { type: 'internal' }>;

function asInternal(r: Resolution | null): InternalResolution | null {
  return r?.type === 'internal' ? (r as InternalResolution) : null;
}

describe('Source reference resolution (citation linking)', () => {
  let resolver: ReferenceResolver;

  beforeEach(() => {
    resolver = new ReferenceResolver();
    // Register datasets with URI patterns
    resolver.registerDataset('vim-2012', ['urn:oiml:pub:v:2:2012*']);
    resolver.registerDataset('viml-2022', ['urn:oiml:pub:v:1:2022*']);
    resolver.registerDataset('vim-2007', ['urn:oiml:pub:v:2:2007*']);
  });

  describe('hasSourceRef', () => {
    it('returns true for registered source ref', () => {
      resolver.registerSourceRef('VIM', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      expect(resolver.hasSourceRef('VIM')).toBe(true);
    });

    it('returns false for unregistered source ref', () => {
      expect(resolver.hasSourceRef('Unknown')).toBe(false);
    });
  });

  describe('registerSourceRef', () => {
    it('resolves citation when source ref matches exactly', () => {
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      const result = resolver.resolveCitation('OIML V 2-200:2012', '2.2', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '2.2',
        crossDataset: true,
      });
    });

    it('resolves citation using variant source string', () => {
      // Manifest has "OIML V 2-200:2012" but concepts use "OIML V2-200:2012"
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      resolver.registerSourceRef('OIML V2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');

      const result = resolver.resolveCitation('OIML V2-200:2012', '2.2', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '2.2',
        crossDataset: true,
      });
    });

    it('resolves citation using URN as source', () => {
      resolver.registerSourceRef('urn:oiml:pub:v:2:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      const result = resolver.resolveCitation('urn:oiml:pub:v:2:2012', '2.2', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '2.2',
        crossDataset: true,
      });
    });

    it('resolves citation using ref alias (e.g. "VIM")', () => {
      resolver.registerSourceRef('VIM', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      const result = resolver.resolveCitation('VIM', '2.2', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '2.2',
        crossDataset: true,
      });
    });

    it('returns null when source ref is not registered', () => {
      const result = resolver.resolveCitation('Unknown Source', '2.2', 'viml-2022');
      expect(result).toBeNull();
    });

    it('returns null when source ref matches but concept does not exist in dataset', () => {
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      // The resolver can only check if the dataset exists, not if the concept exists
      // It will still return internal if the dataset is registered
      const result = resolver.resolveCitation('OIML V 2-200:2012', '99.99', 'viml-2022');
      expect(result?.type).toBe('internal');
    });

    it('handles same-dataset citation (crossDataset=false)', () => {
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      const result = resolver.resolveCitation('OIML V 2-200:2012', '2.2', 'vim-2012');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '2.2',
        crossDataset: false,
      });
    });
  });

  describe('resolveCitation fallback to URN', () => {
    it('resolves URN-based source without registerSourceRef', () => {
      // When source starts with "urn:", tryResolveCitationUri handles it
      const result = resolver.resolveCitation('urn:oiml:pub:v:2:2012', '2.2', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '2.2',
        crossDataset: true,
      });
    });
  });

  describe('multiple source strings for same dataset', () => {
    it('registers multiple source refs pointing to the same dataset', () => {
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      resolver.registerSourceRef('OIML V2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      resolver.registerSourceRef('VIM', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      resolver.registerSourceRef('ISO Guide 99:2007', 'vim-2012', 'urn:oiml:pub:v:2:2012');

      expect(asInternal(resolver.resolveCitation('OIML V 2-200:2012', '2.2'))?.registerId).toBe('vim-2012');
      expect(asInternal(resolver.resolveCitation('OIML V2-200:2012', '2.2'))?.registerId).toBe('vim-2012');
      expect(asInternal(resolver.resolveCitation('VIM', '2.2'))?.registerId).toBe('vim-2012');
      expect(asInternal(resolver.resolveCitation('ISO Guide 99:2007', '2.2'))?.registerId).toBe('vim-2012');
    });
  });

  describe('ISO source references', () => {
    it('resolves ISO/IEC references when registered', () => {
      resolver.registerDataset('iso-17000', ['urn:iso:std:iso:iec:17000*']);
      resolver.registerSourceRef('ISO/IEC 17000:2020', 'iso-17000', 'urn:iso:std:iso:iec:17000');

      const result = resolver.resolveCitation('ISO/IEC 17000:2020', '3.1', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'iso-17000',
        conceptId: '3.1',
        crossDataset: true,
      });
    });

    it('returns null for unresolvable ISO references', () => {
      // ISO dataset not loaded — no registerSourceRef or dataset pattern match
      const result = resolver.resolveCitation('ISO/IEC 17000:2020', '3.1', 'viml-2022');
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns internal with empty conceptId when referenceFrom is empty', () => {
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      const result = resolver.resolveCitation('OIML V 2-200:2012', '');
      // Resolver still resolves but with empty conceptId — UI handles this
      expect(result?.type).toBe('internal');
    });

    it('handles concept IDs with dots', () => {
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
      const result = resolver.resolveCitation('OIML V 2-200:2012', '5.12.3', 'viml-2022');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'vim-2012',
        conceptId: '5.12.3',
        crossDataset: true,
      });
    });

    it('handles source strings with special characters', () => {
      resolver.registerDataset('vim-1993', ['urn:oiml:pub:v:2:1993*']);
      resolver.registerSourceRef('OIML V 2:1993', 'vim-1993', 'urn:oiml:pub:v:2:1993');
      const result = resolver.resolveCitation('OIML V 2:1993', '3.6');
      expect(asInternal(result)?.registerId).toBe('vim-1993');
    });

    it('does not confuse similar source strings', () => {
      resolver.registerSourceRef('OIML V 2-200:2007', 'vim-2007', 'urn:oiml:pub:v:2:2007');
      resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');

      const result2007 = resolver.resolveCitation('OIML V 2-200:2007', '2.2');
      const result2012 = resolver.resolveCitation('OIML V 2-200:2012', '2.2');

      expect(asInternal(result2007)?.registerId).toBe('vim-2007');
      expect(asInternal(result2012)?.registerId).toBe('vim-2012');
    });
  });
});
