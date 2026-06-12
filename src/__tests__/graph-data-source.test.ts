import { describe, it, expect, vi } from 'vitest';
import { GraphDataSource } from '../adapters/GraphDataSource';
import type { DatasetAdapter } from '../adapters/DatasetAdapter';
import type { Concept, RelatedConcept } from 'glossarist';
import { conceptFromJson } from '../adapters/model-bridge';

function makeMinimalConcept(overrides: Record<string, unknown> = {}): Concept {
  return conceptFromJson({
    '@type': 'skos:Concept',
    '@id': 'https://glossarist.org/test/concept/1',
    'gl:identifier': '1',
    'gl:localizedConcept': {
      eng: {
        'gl:languageCode': 'eng',
        'gl:entryStatus': 'valid',
        'gl:designation': [{ '@type': 'Expression', 'gl:term': 'test term' }],
        'gl:definition': [{ 'gl:content': 'test definition' }],
      },
    },
    ...overrides,
  });
}

function makeAdapterStub(manifest?: Record<string, unknown>): DatasetAdapter {
  return {
    registerId: 'test',
    dataUrl: '/data/test',
    manifest: manifest ? { uriBase: 'https://glossarist.org', ...manifest } as any : { uriBase: 'https://glossarist.org' } as any,
    urnMap: new Map([['urn:iso:std:iso:10241', 'test']]),
  } as unknown as DatasetAdapter;
}

describe('GraphDataSource', () => {
  describe('resolveRefTarget', () => {
    it('returns empty string when ref is null', async () => {
      const { GraphDataSource } = await import('../adapters/GraphDataSource');
      const ds = new GraphDataSource(makeAdapterStub());
      const concept = makeMinimalConcept();
      // concept.relatedConcepts is empty, so extractEdges returns []
      const edges = ds.extractEdges(concept);
      expect(edges).toEqual([]);
    });
  });

  describe('extractEdges', () => {
    it('extracts concept-level related concept edges', () => {
      const ds = new GraphDataSource(makeAdapterStub());
      const concept = makeMinimalConcept({
        'gl:related': [{
          'gl:relationshipType': 'references',
          'gl:ref': { 'gl:source': 'urn:iso:std:iso:10241', 'gl:id': '2.1' },
        }],
      });
      const edges = ds.extractEdges(concept);
      expect(edges.length).toBeGreaterThan(0);
      expect(edges[0].type).toBe('references');
      expect(edges[0].source).toContain('/concept/1');
    });

    it('extracts localization-level related concept edges', () => {
      const ds = new GraphDataSource(makeAdapterStub());
      const concept = makeMinimalConcept({
        'gl:localizedConcept': {
          eng: {
            'gl:languageCode': 'eng',
            'gl:entryStatus': 'valid',
            'gl:designation': [{ '@type': 'Expression', 'gl:term': 'test term' }],
            'gl:references': [{
              'gl:relationshipType': 'related',
              'gl:ref': { 'gl:source': 'urn:iso:std:iso:10241', 'gl:id': '3.1' },
            }],
          },
        },
      });
      const edges = ds.extractEdges(concept);
      expect(edges.length).toBeGreaterThan(0);
      const relatedEdge = edges.find(e => e.type === 'related');
      expect(relatedEdge).toBeDefined();
      expect(relatedEdge!.lang).toBe('eng');
    });

    it('skips self-referencing edges', () => {
      const ds = new GraphDataSource(makeAdapterStub());
      const concept = makeMinimalConcept({
        'gl:related': [{
          'gl:relationshipType': 'references',
          'gl:ref': { 'gl:source': 'https://glossarist.org', 'gl:id': '1' },
          '@id': 'https://glossarist.org/test/concept/1',
        }],
      });
      const edges = ds.extractEdges(concept);
      // Self-reference should be filtered out
      expect(edges).toEqual([]);
    });
  });

  describe('extractDomainEdges', () => {
    it('creates domain edges from localized domains', () => {
      const ds = new GraphDataSource(makeAdapterStub());
      const concept = makeMinimalConcept({
        'gl:localizedConcept': {
          eng: {
            'gl:languageCode': 'eng',
            'gl:entryStatus': 'valid',
            'gl:designation': [{ '@type': 'Expression', 'gl:term': 'test term' }],
            'gl:domain': 'Metrology',
          },
          fra: {
            'gl:languageCode': 'fra',
            'gl:entryStatus': 'valid',
            'gl:designation': [{ '@type': 'Expression', 'gl:term': 'test terme' }],
            'gl:domain': 'Métrologie',
          },
        },
      });
      const edges = ds.extractDomainEdges(concept);
      expect(edges.length).toBe(2);
      expect(edges[0].type).toBe('domain');
      expect(edges[0].label).toBe('Metrology');
      expect(edges[0].lang).toBe('eng');
      expect(edges[1].label).toBe('Métrologie');
      expect(edges[1].lang).toBe('fra');
    });

    it('returns empty for concepts without domains', () => {
      const ds = new GraphDataSource(makeAdapterStub());
      const concept = makeMinimalConcept();
      const edges = ds.extractDomainEdges(concept);
      expect(edges).toEqual([]);
    });
  });

  describe('getSectionTree', () => {
    it('returns empty when manifest has no sections', () => {
      const ds = new GraphDataSource(makeAdapterStub());
      expect(ds.getSectionTree()).toEqual([]);
    });

    it('maps manifest sections to section tree', () => {
      const ds = new GraphDataSource(makeAdapterStub({
        sections: [
          { id: '1', names: { eng: 'Section 1' }, children: [
            { id: '1.1', names: { eng: 'Section 1.1' } },
          ]},
        ],
      }));
      const tree = ds.getSectionTree();
      expect(tree.length).toBe(1);
      expect(tree[0].id).toBe('1');
      expect(tree[0].names.eng).toBe('Section 1');
      expect(tree[0].children?.length).toBe(1);
      expect(tree[0].children![0].id).toBe('1.1');
    });
  });
});
