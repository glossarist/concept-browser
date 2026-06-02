import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatasetAdapter } from '../adapters/DatasetAdapter';
import { conceptFromJson } from '../adapters/model-bridge';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockJsonResponse(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

describe('DatasetAdapter', () => {
  let adapter: DatasetAdapter;

  beforeEach(() => {
    adapter = new DatasetAdapter('test', '/data/test');
    mockFetch.mockReset();
  });

  describe('loadManifest', () => {
    it('loads and stores the manifest', async () => {
      const manifest = {
        id: 'test',
        title: 'Test Dataset',
        description: 'A test',
        owner: 'Test',
        baseUrl: '/data/test',
        languages: ['eng', 'fra'],
        conceptCount: 100,
        chunkSize: 500,
      };
      mockFetch.mockReturnValue(mockJsonResponse(manifest));

      const result = await adapter.loadManifest();
      expect(result.title).toBe('Test Dataset');
      expect(adapter.manifest?.id).toBe('test');
      expect(mockFetch).toHaveBeenCalledWith('/data/test/manifest.json');
    });

    it('throws on fetch failure', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: false,
        status: 404,
      } as Response));

      await expect(adapter.loadManifest()).rejects.toThrow('Failed to load manifest');
    });
  });

  describe('loadIndex', () => {
    it('loads and indexes concept summaries', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 3,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '102-01-01', designations: { eng: 'equality' }, eng: 'equality', status: 'Standard' },
          { id: '102-01-02', designations: { eng: 'inequality' }, eng: 'inequality', status: 'Standard' },
          { id: '103-01-02', designations: { eng: 'functional' }, eng: 'functional', status: 'Standard' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));

      await adapter.loadIndex();
      expect(adapter.getConcepts().length).toBe(3);
      expect(adapter.getIndexEntry('103-01-02')?.eng).toBe('functional');
      expect(adapter.getConceptCount()).toBe(3);
    });
  });

  describe('fetchConcept', () => {
    it('fetches and caches concept documents', async () => {
      const concept = {
        '@context': 'https://glossarist.org/ns/context.jsonld',
        '@id': 'https://glossarist.org/test/concept/103-01-02',
        '@type': 'gl:Concept',
        'gl:identifier': '103-01-02',
        'gl:localizedConcept': {
          eng: {
            '@id': 'https://glossarist.org/test/concept/103-01-02/eng',
            '@type': 'gl:LocalizedConcept',
            'gl:languageCode': 'eng',
            'gl:designation': [
              { '@type': 'gl:Expression', 'gl:normativeStatus': 'preferred', 'gl:term': 'functional' },
            ],
            'gl:definition': [
              { '@type': 'gl:DetailedDefinition', 'gl:content': 'A functional relationship...' },
            ],
          },
        },
      };
      mockFetch.mockReturnValue(mockJsonResponse(concept));

      const result = await adapter.fetchConcept('103-01-02');
      expect(result.id).toBe('103-01-02');
      expect(mockFetch).toHaveBeenCalledWith('/data/test/concepts/103-01-02.json');

      // Second call should use cache
      mockFetch.mockReset();
      const cached = await adapter.fetchConcept('103-01-02');
      expect(cached.id).toBe('103-01-02');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws on missing concept', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: false,
        status: 404,
      } as Response));

      await expect(adapter.fetchConcept('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('search', () => {
    it('finds concepts by term substring', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 3,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '102-01-01', designations: { eng: 'equality' }, eng: 'equality', status: 'Standard' },
          { id: '102-01-02', designations: { eng: 'inequality' }, eng: 'inequality', status: 'Standard' },
          { id: '103-01-02', designations: { eng: 'functional' }, eng: 'functional', status: 'Standard' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('func');
      expect(hits.length).toBe(1);
      expect(hits[0].conceptId).toBe('103-01-02');
      expect(hits[0].designation).toBe('functional');
    });

    it('finds concepts by ID', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 1,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '103-01-02', designations: { eng: 'functional' }, eng: 'functional', status: 'Standard' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('103-01-02');
      expect(hits.length).toBe(1);
      expect(hits[0].conceptId).toBe('103-01-02');
    });

    it('is case insensitive', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 1,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '102-01-01', designations: { eng: 'Equality' }, eng: 'Equality', status: 'Standard' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('EQUALITY');
      expect(hits.length).toBe(1);
    });

    it('returns empty for no match', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 1,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '102-01-01', designations: { eng: 'equality' }, eng: 'equality', status: 'Standard' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('xyznotfound');
      expect(hits.length).toBe(0);
    });

    it('ranks exact matches above starts-with above contains', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 3,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '1', designations: { eng: 'mass' }, eng: 'mass', status: 'valid' },
          { id: '2', designations: { eng: 'mass flow rate' }, eng: 'mass flow rate', status: 'valid' },
          { id: '3', designations: { eng: 'center of mass' }, eng: 'center of mass', status: 'valid' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('mass');
      // Exact match first, then starts-with, then contains
      expect(hits[0].conceptId).toBe('1');
      expect(hits[1].conceptId).toBe('2');
      expect(hits[2].conceptId).toBe('3');
    });

    it('ranks ID exact match highest', async () => {
      const index = {
        registerId: 'test',
        schemaVersion: '1.0.0',
        conceptCount: 2,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '102-01-01', designations: { eng: 'field' }, eng: 'field', status: 'valid' },
          { id: '102-01-02', designations: { eng: 'electromagnetic field' }, eng: 'electromagnetic field', status: 'valid' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('102-01-01');
      expect(hits[0].conceptId).toBe('102-01-01');
      expect(hits[0].matchField).toBe('id');
    });
  });

  describe('extractEdges', () => {
    it('extracts cross-reference edges from gl:references', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/iev/concept/103-01-02', 'gl:term': 'functional' },
              { '@id': 'https://glossarist.org/iev/concept/102-01-02', 'gl:term': 'inequality' },
            ],
          },
        },
      });

      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(2);
      expect(edges[0].target).toBe('https://glossarist.org/iev/concept/103-01-02');
      expect(edges[0].type).toBe('references');
      expect(edges[0].label).toBe('functional');
    });

    it('tags reference edges with language', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/1',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: { 'gl:references': [
            { '@id': 'https://glossarist.org/test/concept/2', 'gl:term': 'other' },
          ]},
          fra: { 'gl:references': [
            { '@id': 'https://glossarist.org/test/concept/3', 'gl:term': 'autre' },
          ]},
        },
      });
      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(2);
      expect(edges.find(e => e.lang === 'eng')?.target).toContain('/concept/2');
      expect(edges.find(e => e.lang === 'fra')?.target).toContain('/concept/3');
    });

    it('skips self-references', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/test/concept/102-01-01', 'gl:term': 'self' },
            ],
          },
        },
      });

      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(0);
    });

    it('handles concepts with no references', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: {},
        },
      });

      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(0);
    });

    it('handles empty localizedConcept', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {},
      });

      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(0);
    });

    it('collects references from multiple languages without duplication', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/iev/concept/103-01-02', 'gl:term': 'functional' },
            ],
          },
          fra: {
            'gl:references': [
              { '@id': 'https://glossarist.org/iev/concept/103-01-02', 'gl:term': 'fonctionnel' },
            ],
          },
        },
      });

      // Same target from two languages — both edges are kept (different labels)
      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(2);
    });

    it('extracts inline IEV cross-references from gl:references', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/112-01-01',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/iev/concept/102-02-18', 'gl:term': 'scalar' },
              { '@id': 'https://glossarist.org/iev/concept/112-01-14', 'gl:term': 'unit' },
            ],
          },
        },
      });

      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(2);
      expect(edges[0].target).toBe('https://glossarist.org/iev/concept/102-02-18');
      expect(edges[0].label).toBe('scalar');
      expect(edges[1].target).toBe('https://glossarist.org/iev/concept/112-01-14');
      expect(edges[1].label).toBe('unit');
    });

    it('extracts inline URN cross-references from gl:references', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/3.1.1.1',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/isotc204/concept/3.1.1.6', 'gl:term': 'entity' },
            ],
          },
        },
      });

      const edges = adapter.extractEdges(concept);
      expect(edges.length).toBe(1);
      expect(edges[0].target).toBe('https://glossarist.org/isotc204/concept/3.1.1.6');
      expect(edges[0].label).toBe('entity');
    });
  });

  describe('extractDomainEdges', () => {
    it('extracts domain edges from gl:domain field per language', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/3',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: { 'gl:domain': 'geometry' },
          fra: { 'gl:domain': 'géométrie' },
        },
      });
      const edges = adapter.extractDomainEdges(concept);
      expect(edges.length).toBe(2);
      expect(edges.every(e => e.type === 'domain')).toBe(true);
      expect(edges.find(e => e.lang === 'eng')?.target).toContain('/domain/geometry');
      expect(edges.find(e => e.lang === 'fra')?.target).toContain('/domain/gomtrie');
      expect(edges.find(e => e.lang === 'eng')?.label).toBe('geometry');
      expect(edges.find(e => e.lang === 'fra')?.label).toBe('géométrie');
    });

    it('handles same domain across languages', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/1',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {
          eng: { 'gl:domain': 'metadata' },
          fra: { 'gl:domain': 'metadata' },
        },
      });
      const edges = adapter.extractDomainEdges(concept);
      expect(edges.length).toBe(2);
      expect(edges[0].target).toBe(edges[1].target);
      expect(edges[0].target).toContain('/domain/metadata');
    });

    it('skips concepts without gl:domain', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/1',
        '@type': 'gl:Concept',
        'gl:localizedConcept': { eng: {} },
      });
      const edges = adapter.extractDomainEdges(concept);
      expect(edges.length).toBe(0);
    });

    it('handles empty localizedConcept', () => {
      const concept = conceptFromJson({
        '@id': 'https://glossarist.org/test/concept/1',
        '@type': 'gl:Concept',
        'gl:localizedConcept': {},
      });
      const edges = adapter.extractDomainEdges(concept);
      expect(edges.length).toBe(0);
    });
  });

  describe('loadDomainNodes', () => {
    it('loads domain nodes from domain-nodes.json', async () => {
      mockFetch.mockReturnValue(mockJsonResponse({
        registerId: 'test',
        domainNodes: [
          { uri: 'https://glossarist.org/test/domain/iso-19107', label: 'ISO 19107', registerId: 'test', conceptCount: 147 },
        ],
      }));
      const nodes = await adapter.loadDomainNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].nodeType).toBe('domain');
      expect(nodes[0].status).toBe('domain');
      expect(nodes[0].loaded).toBe(true);
      expect(nodes[0].designations.eng).toBe('ISO 19107');
      expect(mockFetch).toHaveBeenCalledWith('/data/test/domain-nodes.json');
    });

    it('returns empty array on fetch failure', async () => {
      mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 404 } as Response));
      const nodes = await adapter.loadDomainNodes();
      expect(nodes).toEqual([]);
    });
  });

  describe('getLanguages', () => {
    it('returns languages from manifest', async () => {
      const manifest = {
        id: 'test', languages: ['eng', 'fra', 'deu'], chunkSize: 500,
      };
      mockFetch.mockReturnValue(mockJsonResponse(manifest));
      await adapter.loadManifest();

      expect(adapter.getLanguages()).toEqual(['eng', 'fra', 'deu']);
    });

    it('returns empty array without manifest', () => {
      expect(adapter.getLanguages()).toEqual([]);
    });
  });
});
