import { describe, it, expect } from 'vitest';
import { FORMAT_REGISTRY, conceptToTurtle, conceptToSkosJsonLd } from '../utils/concept-formats';
import { Concept } from 'glossarist';

function makeConcept(overrides: Record<string, unknown> = {}): Concept {
  return Concept.fromJSON({
    id: '1',
    uri: 'https://glossarist.org/test/concept/1',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [
          { type: 'expression', designation: 'test term', normative_status: 'preferred' },
          { type: 'expression', designation: 'alt term', normative_status: 'admitted' },
        ],
        definition: [{ content: 'a definition' }],
        notes: [{ content: 'a note' }],
      },
      deu: {
        language_code: 'deu',
        entry_status: 'valid',
        terms: [
          { type: 'expression', designation: 'Testbegriff', normative_status: 'preferred' },
        ],
        definition: [{ content: 'eine Definition' }],
      },
    },
    ...overrides,
  });
}

describe('FORMAT_REGISTRY', () => {
  it('has ttl, jsonld, yaml entries', () => {
    expect(FORMAT_REGISTRY.ttl).toBeDefined();
    expect(FORMAT_REGISTRY.jsonld).toBeDefined();
    expect(FORMAT_REGISTRY.yaml).toBeDefined();
  });

  it('each entry has extension, label, mediaType', () => {
    for (const [, desc] of Object.entries(FORMAT_REGISTRY)) {
      expect(desc.extension).toBeTruthy();
      expect(desc.label).toBeTruthy();
      expect(desc.mediaType).toBeTruthy();
    }
  });
});

describe('conceptToTurtle', () => {
  it('generates valid Turtle with SKOS predicates', () => {
    const ttl = conceptToTurtle(makeConcept());
    expect(ttl).toContain('@prefix skos:');
    expect(ttl).toContain('a skos:Concept');
    expect(ttl).toContain('skos:prefLabel "test term"@eng');
    expect(ttl).toContain('skos:altLabel "alt term"@eng');
    expect(ttl).toContain('skos:prefLabel "Testbegriff"@deu');
    expect(ttl).toContain('skos:definition "a definition"@eng');
    expect(ttl).toContain('skos:scopeNote "a note"@eng');
    expect(ttl).toContain('skos:notation "1"');
  });

  it('escapes special characters in Turtle', () => {
    const concept = Concept.fromJSON({
      id: '1',
      uri: 'https://glossarist.org/test/concept/1',
      localizations: {
        eng: {
          language_code: 'eng',
          terms: [{ type: 'expression', designation: 'test', normative_status: 'preferred' }],
          definition: [{ content: 'has "quotes" and \\backslash' }],
        },
      },
    });
    const ttl = conceptToTurtle(concept);
    expect(ttl).toContain('\\"quotes\\"');
    expect(ttl).toContain('\\\\backslash');
  });

  it('handles empty concept gracefully', () => {
    const ttl = conceptToTurtle(Concept.fromJSON({}));
    expect(ttl).toContain('a skos:Concept');
    expect(ttl).toContain('skos:notation ""');
  });
});

describe('conceptToSkosJsonLd', () => {
  it('generates SKOS JSON-LD with language maps', () => {
    const jsonld = conceptToSkosJsonLd(makeConcept());
    const parsed = JSON.parse(jsonld);

    expect(parsed['@type']).toBe('skos:Concept');
    expect(parsed['@id']).toBe('https://glossarist.org/test/concept/1');
    expect(parsed['skos:notation']).toBe('1');
    expect(parsed['skos:prefLabel']).toEqual({ eng: 'test term', deu: 'Testbegriff' });
    expect(parsed['skos:altLabel']).toEqual({ eng: 'alt term' });
    expect(parsed['skos:definition']).toEqual({ eng: 'a definition', deu: 'eine Definition' });
  });

  it('uses @language container in context', () => {
    const jsonld = conceptToSkosJsonLd(makeConcept());
    const parsed = JSON.parse(jsonld);
    expect(parsed['@context']['@language']).toEqual({ '@container': '@language' });
  });

  it('omits empty language maps', () => {
    const concept = Concept.fromJSON({ id: '1', uri: 'https://glossarist.org/test/concept/1' });
    const parsed = JSON.parse(conceptToSkosJsonLd(concept));
    expect(parsed['skos:prefLabel']).toBeUndefined();
    expect(parsed['skos:definition']).toBeUndefined();
  });
});
