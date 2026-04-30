import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatasetAdapter } from '../adapters/DatasetAdapter';

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
          { id: '102-01-01', eng: 'equality', status: 'Standard' },
          { id: '102-01-02', eng: 'inequality', status: 'Standard' },
          { id: '103-01-02', eng: 'functional', status: 'Standard' },
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
      expect(result['gl:identifier']).toBe('103-01-02');
      expect(mockFetch).toHaveBeenCalledWith('/data/test/concepts/103-01-02.json');

      // Second call should use cache
      mockFetch.mockReset();
      const cached = await adapter.fetchConcept('103-01-02');
      expect(cached['gl:identifier']).toBe('103-01-02');
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
          { id: '102-01-01', eng: 'equality', status: 'Standard' },
          { id: '102-01-02', eng: 'inequality', status: 'Standard' },
          { id: '103-01-02', eng: 'functional', status: 'Standard' },
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
          { id: '103-01-02', eng: 'functional', status: 'Standard' },
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
          { id: '102-01-01', eng: 'Equality', status: 'Standard' },
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
          { id: '102-01-01', eng: 'equality', status: 'Standard' },
        ],
      };
      mockFetch.mockReturnValue(mockJsonResponse(index));
      await adapter.loadIndex();

      const hits = adapter.search('xyznotfound');
      expect(hits.length).toBe(0);
    });
  });

  describe('extractEdges', () => {
    it('extracts cross-reference edges from gl:references', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/iev/concept/103-01-02', 'gl:term': 'functional' },
              { '@id': 'https://glossarist.org/iev/concept/102-01-02', 'gl:term': 'inequality' },
            ],
          },
        },
      };

      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(2);
      expect(edges[0].target).toBe('https://glossarist.org/iev/concept/103-01-02');
      expect(edges[0].type).toBe('references');
      expect(edges[0].label).toBe('functional');
    });

    it('skips self-references', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/test/concept/102-01-01', 'gl:term': 'self' },
            ],
          },
        },
      };

      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(0);
    });

    it('handles concepts with no references', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        'gl:localizedConcept': {
          eng: {},
        },
      };

      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(0);
    });

    it('handles empty localizedConcept', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/102-01-01',
        'gl:localizedConcept': {},
      };

      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(0);
    });

    it('collects references from multiple languages without duplication', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/102-01-01',
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
      };

      // Same target from two languages — both edges are kept (different labels)
      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(2);
    });

    it('extracts inline IEV cross-references from gl:references', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/112-01-01',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/iev/concept/102-02-18', 'gl:term': 'scalar' },
              { '@id': 'https://glossarist.org/iev/concept/112-01-14', 'gl:term': 'unit' },
            ],
          },
        },
      };

      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(2);
      expect(edges[0].target).toBe('https://glossarist.org/iev/concept/102-02-18');
      expect(edges[0].label).toBe('scalar');
      expect(edges[1].target).toBe('https://glossarist.org/iev/concept/112-01-14');
      expect(edges[1].label).toBe('unit');
    });

    it('extracts inline URN cross-references from gl:references', () => {
      const concept = {
        '@id': 'https://glossarist.org/test/concept/3.1.1.1',
        'gl:localizedConcept': {
          eng: {
            'gl:references': [
              { '@id': 'https://glossarist.org/isotc204/concept/3.1.1.6', 'gl:term': 'entity' },
            ],
          },
        },
      };

      const edges = adapter.extractEdges(concept as any);
      expect(edges.length).toBe(1);
      expect(edges[0].target).toBe('https://glossarist.org/isotc204/concept/3.1.1.6');
      expect(edges[0].label).toBe('entity');
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
