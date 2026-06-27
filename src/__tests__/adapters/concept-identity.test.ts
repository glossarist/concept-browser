import { describe, it, expect } from 'vitest';
import { ConceptIdentity } from '../../adapters/concept-identity';
import { InvalidConceptIdentityError, InvalidConceptUriError } from '../../errors';

describe('ConceptIdentity', () => {
  it('derives uri, slug, and path from parts', () => {
    const id = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    expect(id.uri).toBe('https://glossarist.org/iso-10303-2/concept/3.1.1');
    expect(id.slug).toBe('3.1.1');
    expect(id.path).toBe('iso-10303-2/concepts/3.1.1');
  });

  it('rejects empty parts with a typed SerializationError', () => {
    expect(() => new ConceptIdentity('', 'r', 'b')).toThrow(InvalidConceptIdentityError);
    expect(() => new ConceptIdentity('x', '', 'b')).toThrow(InvalidConceptIdentityError);
    expect(() => new ConceptIdentity('x', 'r', '')).toThrow(InvalidConceptIdentityError);
  });

  it('equals another identity with the same URI', () => {
    const a = new ConceptIdentity('1', 'r', 'https://glossarist.org');
    const b = new ConceptIdentity('1', 'r', 'https://glossarist.org');
    expect(a.equals(b)).toBe(true);
  });

  it('does not equal an identity with a different local id', () => {
    const a = new ConceptIdentity('1', 'r', 'https://glossarist.org');
    const b = new ConceptIdentity('2', 'r', 'https://glossarist.org');
    expect(a.equals(b)).toBe(false);
  });

  it('round-trips through fromUri', () => {
    const original = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    const roundTrip = ConceptIdentity.fromUri(original.uri);
    expect(roundTrip.equals(original)).toBe(true);
  });

  it('fromUri rejects non-concept URIs with a typed error', () => {
    expect(() => ConceptIdentity.fromUri('https://example.org/foo/bar')).toThrow(InvalidConceptUriError);
  });

  it('isConceptUri recognizes canonical URIs', () => {
    expect(ConceptIdentity.isConceptUri('https://glossarist.org/iso-10303-2/concept/3.1.1')).toBe(true);
    expect(ConceptIdentity.isConceptUri('https://example.org')).toBe(false);
  });

  it('localizationUri follows the canonical sub-resource pattern', () => {
    const id = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    expect(id.localizationUri('eng')).toBe('https://glossarist.org/iso-10303-2/concept/3.1.1/eng');
  });

  it('designationUri composes localization + desig slugs', () => {
    const id = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    expect(id.designationUri('eng', 'atomic_data_unit')).toBe(
      'https://glossarist.org/iso-10303-2/concept/3.1.1/eng/desig/atomic_data_unit',
    );
  });

  it('domainUri follows the register-scoped pattern', () => {
    const id = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    expect(id.domainUri('geometry')).toBe('https://glossarist.org/iso-10303-2/domain/geometry');
  });

  it('toString returns the URI for logging', () => {
    const id = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    expect(`${id}`).toBe('https://glossarist.org/iso-10303-2/concept/3.1.1');
  });

  it('toJSON serializes the parts', () => {
    const id = new ConceptIdentity('3.1.1', 'iso-10303-2', 'https://glossarist.org');
    expect(id.toJSON()).toEqual({
      localId: '3.1.1',
      registerId: 'iso-10303-2',
      uriBase: 'https://glossarist.org',
    });
  });
});
