import { describe, expect, it } from 'vitest';
import { Citation, Concept } from 'glossarist';
import { collectStandardKeys, standardKey, standardLabel } from '../utils/source-standard';

describe('standard references', () => {
  it.each([
    [{ source: 'ISO', id: '19165-2:2020' }, 'iso 19165-2:2020', 'ISO 19165-2:2020'],
    [{ id: '19165-2:2020' }, '19165-2:2020', '19165-2:2020'],
    [{ source: 'ISO 19165-2:2020' }, 'iso 19165-2:2020', 'ISO 19165-2:2020'],
    [{ source: '  ISO\t IEC ', id: '  17000:2020\n' }, 'iso iec 17000:2020', 'ISO IEC 17000:2020'],
    [{ source: ' ', id: '19165-2:2020' }, '19165-2:2020', '19165-2:2020'],
  ])('combines usable source and id: %j', (ref, key, label) => {
    expect(standardKey(ref)).toBe(key);
    expect(standardLabel(ref)).toBe(label);
  });

  it.each([undefined, null, {}, { source: ' \t', id: '\n' }])('returns null for unusable ref %j', (ref) => {
    expect(standardKey(ref)).toBeNull();
    expect(standardLabel(ref)).toBeNull();
  });

  it('ignores clauses and localities without changing the input', () => {
    const ref = Object.freeze({ source: 'ISO', id: '19165-2:2020', clause: '3.1', locality: '3.1' });
    const otherClause = { ...ref, clause: '4.2', locality: '4.2' };
    expect(standardKey(ref)).toBe('iso 19165-2:2020');
    expect(standardKey(otherClause)).toBe(standardKey(ref));
    expect(standardLabel(ref)).toBe('ISO 19165-2:2020');
  });

  it('distinguishes standards and editions but ignores case', () => {
    const ref = { source: 'ISO', id: '19165-2:2020' };
    expect(standardKey({ ...ref, source: 'iso' })).toBe(standardKey(ref));
    expect(standardKey({ ...ref, id: '19165-2:2024' })).not.toBe(standardKey(ref));
    expect(standardKey({ ...ref, id: '19115:2020' })).not.toBe(standardKey(ref));
  });
});

describe('collectStandardKeys', () => {
  it('collects unique authoritative references across the concept and all languages', () => {
    const source = (id: string, type = 'authoritative') => ({ type, origin: { ref: { source: 'ISO', id } } });
    const concept = Concept.fromJSON({
      id: '1',
      sources: [source('19165-2:2020'), source('704:2022', 'lineage'), { type: 'authoritative' }],
      localizations: {
        eng: { sources: [source('19165-2:2020'), source('19165-2:2024')] },
        fra: { sources: [source('1087:2019'), source('999:2020', 'lineage'), source('998:2020', '')] },
      },
    });
    expect(collectStandardKeys(concept)).toEqual(['iso 19165-2:2020', 'iso 19165-2:2024', 'iso 1087:2019']);
  });

  it('returns no keys for a concept without sources', () => {
    expect(collectStandardKeys(Concept.fromJSON({ id: '1' }))).toEqual([]);
  });

  it('deduplicates citations of different clauses of the same standard', () => {
    const concept = Concept.fromJSON({
      id: '1',
      sources: ['3.1', '4.2'].map(clause => ({
        type: 'authoritative',
        origin: Citation.fromJSON({
          ref: { source: 'ISO', id: '19165-2:2020' },
          locality: { type: 'clause', reference_from: clause },
        }),
      })),
    });
    expect(concept.sources[0].origin?.locality).not.toEqual(concept.sources[1].origin?.locality);
    expect(collectStandardKeys(concept)).toEqual(['iso 19165-2:2020']);
  });
});
