import { describe, it, expect } from 'vitest';
import { conceptFromJson, getAnnotations } from '../adapters/model-bridge';

function makeJsonLdConcept(annotations: { content: string }[] = []) {
  return {
    '@type': 'skos:Concept',
    '@id': 'https://glossarist.org/test/concept/1',
    'gl:identifier': '1',
    'gl:localizedConcept': {
      eng: {
        'gl:languageCode': 'eng',
        'gl:designation': [{ '@type': 'Expression', 'gl:term': 'test term' }],
        'gl:definition': [{ 'gl:content': 'test definition' }],
        'gl:annotations': annotations.map(a => ({ 'gl:content': a.content })),
        'gl:notes': [{ 'gl:content': 'a note' }],
      },
      fra: {
        'gl:languageCode': 'fra',
        'gl:designation': [{ '@type': 'Expression', 'gl:term': 'terme test' }],
        'gl:definition': [{ 'gl:content': 'définition test' }],
      },
    },
  };
}

describe('annotations bridge (getAnnotations)', () => {
  it('preserves annotations from JSON-LD', () => {
    const doc = makeJsonLdConcept([
      { content: 'first annotation' },
      { content: 'second annotation' },
    ]);
    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng');
    expect(lc).toBeTruthy();

    const ann = getAnnotations(lc!);
    expect(ann).toHaveLength(2);
    expect(ann[0].content).toBe('first annotation');
    expect(ann[1].content).toBe('second annotation');
  });

  it('returns empty array when no annotations present', () => {
    const doc = makeJsonLdConcept([]);
    const concept = conceptFromJson(doc);
    const lc = concept.localization('fra')!;
    expect(getAnnotations(lc)).toEqual([]);
  });

  it('returns empty array for language without annotations', () => {
    const doc = makeJsonLdConcept([{ content: 'only eng' }]);
    const concept = conceptFromJson(doc);
    const lc = concept.localization('fra')!;
    expect(getAnnotations(lc)).toEqual([]);
  });

  it('preserves annotations from glossarist native format', () => {
    const doc = {
      id: '1',
      localizations: {
        eng: {
          language_code: 'eng',
          terms: [{ designation: 'test', type: 'expression' }],
          definition: [{ content: 'def' }],
          annotations: [{ content: 'native annotation' }],
        },
      },
    };
    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;
    const ann = getAnnotations(lc);
    expect(ann).toHaveLength(1);
    expect(ann[0].content).toBe('native annotation');
  });

  it('model-backed fields are unaffected by annotation bridge', () => {
    const doc = makeJsonLdConcept([{ content: 'annot' }]);
    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;

    expect(lc.definitions).toHaveLength(1);
    expect(lc.definitions[0].content).toBe('test definition');
    expect(lc.notes).toHaveLength(1);
    expect(lc.notes[0].content).toBe('a note');
    expect(lc.primaryDesignation).toBe('test term');
    expect(getAnnotations(lc)).toHaveLength(1);
  });
});
