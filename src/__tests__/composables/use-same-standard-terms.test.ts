import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, shallowReactive, type EffectScope } from 'vue';
import { Concept } from 'glossarist';
import { DatasetAdapter } from '../../adapters/DatasetAdapter';
import type { ConceptSummary } from '../../adapters/types';
import { useSameStandardTerms } from '../../composables/use-same-standard-terms';

const stores = vi.hoisted(() => ({ vocabulary: null as any, ui: null as any }));
vi.mock('../../stores/vocabulary', () => ({ useVocabularyStore: () => stores.vocabulary }));
vi.mock('../../stores/ui', () => ({ useUiStore: () => stores.ui }));

const standard = (id: string, type = 'authoritative') => ({
  type,
  origin: { ref: { source: 'ISO', id } },
});
const concept = (id: string, standards = ['704:2022']) => Concept.fromJSON({
  id,
  sources: standards.map(id => standard(id)),
});
const index = {
  'iso 704:2022': { label: 'ISO 704:2022', conceptIds: ['1', '2', '3', '4'] },
  'iso 1087:2019': { label: 'ISO 1087:2019', conceptIds: ['1', '3'] },
  'iso 999:2020': { label: 'ISO 999:2020', conceptIds: ['5'] },
};
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

async function settle() {
  await nextTick();
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

describe('useSameStandardTerms', () => {
  let registerNumber = 0;
  let scopes: EffectScope[];
  let summaries: Map<string, ConceptSummary>;

  function useTerms(baseUrl?: string) {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => useSameStandardTerms(baseUrl))!;
  }

  beforeEach(() => {
    scopes = [];
    summaries = new Map([
      ['1', { id: '1', designations: { fra: 'courant' }, eng: 'current', status: 'valid' }],
      ['2', { id: '2', designations: { fra: 'terme', eng: 'term' }, eng: 'term', status: 'valid' }],
      ['3', { id: '3', designations: { deu: 'Begriff', eng: 'concept' }, eng: 'concept', status: 'valid' }],
      ['4', { id: '4', designations: {}, eng: '', status: 'valid' }],
      ['5', { id: '5', designations: {}, eng: 'unrelated', status: 'valid' }],
    ]);
    stores.vocabulary = shallowReactive({
      currentRegisterId: `same-standard-${++registerNumber}`,
      currentConceptId: '1',
      currentConcept: concept('1'),
      currentAdapter: {
        getIndexEntry: (id: string) => summaries.get(id),
        ensureAllChunksLoaded: vi.fn(async () => {}),
      },
    });
    stores.ui = shallowReactive({ selectedLang: 'fra' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(index)));
  });

  afterEach(() => {
    scopes.forEach(scope => scope.stop());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns groups directly, gathering concept and localized authoritative sources and excluding the current concept', async () => {
    stores.vocabulary.currentConcept = Concept.fromJSON({
      id: '1',
      sources: [standard('704:2022'), standard('999:2020', 'lineage')],
      localizations: {
        eng: { sources: [standard('704:2022'), standard('1087:2019')] },
      },
    });
    const groups = useTerms('/browser/');
    expect(groups.value).toEqual([]);
    await settle();

    expect(fetch).toHaveBeenCalledWith(`/browser/data/${stores.vocabulary.currentRegisterId}/standards.json`);
    expect(groups.value).toEqual([
      { key: 'iso 704:2022', label: 'ISO 704:2022', terms: [
        { conceptId: '2', designation: 'terme' },
        { conceptId: '3', designation: 'concept' },
        { conceptId: '4', designation: '4' },
      ] },
      { key: 'iso 1087:2019', label: 'ISO 1087:2019', terms: [
        { conceptId: '3', designation: 'concept' },
      ] },
    ]);
  });

  it('loads summaries from later index chunks without fetching concept payloads', async () => {
    const adapter = new DatasetAdapter('chunked-standard', '/data/chunked-standard');
    adapter.manifest = { conceptCount: 1200 } as any;
    const chunks = Array.from({ length: 3 }, (_, chunk) => ({
      file: `index-${chunk}.json`, count: chunk === 2 ? 200 : 500,
    }));
    const ids = ['1', '2', '600', '1100'];
    const chunkConcepts = (chunk: number) => Array.from({ length: chunks[chunk].count }, (_, offset) => {
      const id = String(chunk * 500 + offset + 1);
      return {
        id,
        designations: ids.includes(id) ? { eng: `term number ${id}` } : {},
        status: 'valid',
      };
    });
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/standards.json')) return response({
        'iso 19165-2:2020': { label: 'ISO 19165-2:2020', conceptIds: ids },
      });
      if (url.endsWith('/index-meta.json')) return response({
        registerId: 'chunked-standard', schemaVersion: '1', conceptCount: 1200,
        chunkSize: 500, chunks,
      });
      const chunk = Number(url.match(/index-(\d)\.json$/)?.[1]);
      if (Number.isInteger(chunk)) return response({ concepts: chunkConcepts(chunk) });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    await adapter.loadIndex();
    expect(adapter.getIndexEntry('2')).toBeDefined();
    expect(adapter.getIndexEntry('600')).toBeUndefined();

    stores.vocabulary.currentRegisterId = 'chunked-standard';
    stores.vocabulary.currentConceptId = '1';
    stores.vocabulary.currentConcept = Concept.fromJSON({
      id: '1', localizations: { eng: { sources: [standard('19165-2:2020')] } },
    });
    stores.vocabulary.currentAdapter = adapter;
    const groups = useTerms('/');
    await vi.waitFor(() => expect(groups.value[0]?.terms.map(term => term.designation)).toEqual([
      'term number 2', 'term number 600', 'term number 1100',
    ]));

    expect(groups.value).toEqual([{
      key: 'iso 19165-2:2020', label: 'ISO 19165-2:2020', terms: [
        { conceptId: '2', designation: 'term number 2' },
        { conceptId: '600', designation: 'term number 600' },
        { conceptId: '1100', designation: 'term number 1100' },
      ],
    }]);
    stores.vocabulary.currentConceptId = '600';
    stores.vocabulary.currentConcept = Concept.fromJSON({
      id: '600', localizations: { eng: { sources: [standard('19165-2:2020')] } },
    });
    await settle();
    expect(groups.value[0].terms).toEqual([
      { conceptId: '1', designation: 'term number 1' },
      { conceptId: '2', designation: 'term number 2' },
      { conceptId: '1100', designation: 'term number 1100' },
    ]);
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/concepts/'));
  });

  it('keeps ID fallbacks after summary loading fails and retries from a later instance', async () => {
    const loaded = new Map<string, ConceptSummary>([
      ['3', summaries.get('3')!],
      ['4', summaries.get('4')!],
    ]);
    const ensureAllChunksLoaded = vi.fn()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockImplementationOnce(async () => {
        loaded.set('2', { id: '2', designations: { eng: 'retried term' }, eng: 'retried term', status: 'valid' });
      });
    stores.vocabulary.currentAdapter = {
      getIndexEntry: (id: string) => loaded.get(id),
      ensureAllChunksLoaded,
    };
    const first = useTerms('/');
    await vi.waitFor(() => expect(ensureAllChunksLoaded).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(first.value[0]?.terms).toEqual([
      { conceptId: '2', designation: '2' },
      { conceptId: '3', designation: 'concept' },
      { conceptId: '4', designation: '4' },
    ]));

    const second = useTerms('/');
    await vi.waitFor(() => expect(ensureAllChunksLoaded).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(second.value[0]?.terms[0]).toEqual({
      conceptId: '2', designation: 'retried term',
    }));
  });

  it('shares deferred summary loading and ignores its completion after register navigation', async () => {
    let resolveOld!: () => void;
    const oldSummaries = new Map<string, ConceptSummary>();
    const oldAdapter = {
      getIndexEntry: (id: string) => oldSummaries.get(id),
      ensureAllChunksLoaded: vi.fn(() => new Promise<void>(resolve => { resolveOld = resolve; })),
    };
    stores.vocabulary.currentAdapter = oldAdapter;
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/standards.json') && url.includes('/old-register/')) return response({
        'iso 704:2022': { label: 'Old standard', conceptIds: ['1', '2'] },
      });
      if (url.endsWith('/standards.json')) return response({
        'iso 704:2022': { label: 'New standard', conceptIds: ['1', '5'] },
      });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    stores.vocabulary.currentRegisterId = 'old-register';
    const first = useTerms('/');
    const second = useTerms('/');
    await vi.waitFor(() => expect(oldAdapter.ensureAllChunksLoaded).toHaveBeenCalledTimes(1));

    stores.vocabulary.currentRegisterId = 'new-register';
    const newSummaries = new Map<string, ConceptSummary>([
      ['1', { id: '1', designations: { eng: 'new current' }, eng: 'new current', status: 'valid' }],
      ['5', { id: '5', designations: { eng: 'new related' }, eng: 'new related', status: 'valid' }],
    ]);
    stores.vocabulary.currentAdapter = {
      getIndexEntry: (id: string) => newSummaries.get(id),
      ensureAllChunksLoaded: vi.fn(async () => {}),
    };
    stores.vocabulary.currentConcept = concept('1');
    const expected = [{
      key: 'iso 704:2022', label: 'New standard',
      terms: [{ conceptId: '5', designation: 'new related' }],
    }];
    await vi.waitFor(() => {
      expect(first.value).toEqual(expected);
      expect(second.value).toEqual(expected);
    });

    oldSummaries.set('2', { id: '2', designations: { eng: 'stale related' }, eng: 'stale related', status: 'valid' });
    resolveOld();
    await settle();
    expect(first.value).toEqual(expected);
    expect(second.value).toEqual(expected);
    expect(oldAdapter.ensureAllChunksLoaded).toHaveBeenCalledTimes(1);
  });

  it('reacts to selected language using English and then the concept ID as fallbacks', async () => {
    const groups = useTerms('/');
    await settle();
    expect(groups.value[0].terms.map(term => term.designation)).toEqual(['terme', 'concept', '4']);

    stores.ui.selectedLang = 'deu';
    await nextTick();
    expect(groups.value[0].terms.map(term => term.designation)).toEqual(['term', 'Begriff', '4']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses the configured default base URL when called without arguments', async () => {
    useTerms();
    await settle();
    expect(fetch).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/${stores.vocabulary.currentRegisterId}/standards.json`);
  });

  it.each(['404', 'network rejection'])('returns no groups for %s', async failure => {
    if (failure === '404') {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    } else {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    }
    const groups = useTerms('/');
    await settle();
    expect(groups.value).toEqual([]);
  });

  it('shares one in-flight request across instances and reuses it during concept navigation', async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise(done => { resolve = done; }));
    const first = useTerms('/');
    const second = useTerms('/');
    await nextTick();
    expect(fetch).toHaveBeenCalledTimes(1);

    resolve(response(index));
    await settle();
    expect(second.value).toEqual(first.value);
    expect(first.value[0].terms).toHaveLength(3);

    stores.vocabulary.currentConceptId = '3';
    stores.vocabulary.currentConcept = concept('3', ['1087:2019']);
    await settle();
    expect(first.value).toEqual([
      { key: 'iso 1087:2019', label: 'ISO 1087:2019', terms: [{ conceptId: '1', designation: 'courant' }] },
    ]);
    expect(second.value).toEqual(first.value);
    const later = useTerms('/');
    await settle();
    expect(later.value).toEqual(first.value);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a rejected request on a later instance and caches the successful response', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('temporarily offline'))
      .mockResolvedValueOnce(response(index));
    const first = useTerms('/');
    await settle();
    expect(first.value).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);

    const second = useTerms('/');
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(second.value).toEqual([{
      key: 'iso 704:2022', label: 'ISO 704:2022', terms: [
        { conceptId: '2', designation: 'terme' },
        { conceptId: '3', designation: 'concept' },
        { conceptId: '4', designation: '4' },
      ],
    }]);

    const third = useTerms('/');
    await settle();
    expect(third.value).toEqual(second.value);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('waits for the new register concept even when its ID matches the previous concept', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(index))
      .mockResolvedValueOnce(response({
        'iso 704:2022': { label: 'New register standard', conceptIds: ['1', '9'] },
      }));
    const groups = useTerms('/');
    await settle();
    expect(groups.value[0].terms).toHaveLength(3);

    stores.vocabulary.currentRegisterId = `same-standard-other-${registerNumber}`;
    const newSummaries = new Map<string, ConceptSummary>([
      ['9', { id: '9', designations: { fra: 'nouveau terme' }, eng: 'new term', status: 'valid' }],
    ]);
    stores.vocabulary.currentAdapter = {
      getIndexEntry: (id: string) => newSummaries.get(id),
      ensureAllChunksLoaded: vi.fn(async () => {}),
    };
    expect(groups.value).toEqual([]);
    await settle();
    expect(groups.value).toEqual([]);

    stores.vocabulary.currentConcept = concept('1');
    await settle();
    expect(groups.value).toEqual([{
      key: 'iso 704:2022', label: 'New register standard',
      terms: [{ conceptId: '9', designation: 'nouveau terme' }],
    }]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keys the cache by full URL, including the base path', async () => {
    useTerms('/first/');
    useTerms('/second/');
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(`/first/data/${stores.vocabulary.currentRegisterId}/standards.json`);
    expect(fetch).toHaveBeenCalledWith(`/second/data/${stores.vocabulary.currentRegisterId}/standards.json`);
  });

  it('clears groups when navigating to a concept without authoritative standards', async () => {
    const groups = useTerms('/');
    await settle();
    expect(groups.value).toHaveLength(1);

    stores.vocabulary.currentConceptId = '5';
    stores.vocabulary.currentConcept = concept('5', []);
    await settle();
    expect(groups.value).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale register response after navigation', async () => {
    let resolveOld!: (value: Response) => void;
    vi.mocked(fetch)
      .mockImplementationOnce(() => new Promise(done => { resolveOld = done; }))
      .mockResolvedValueOnce(response({
        'iso 704:2022': { label: 'New register standard', conceptIds: ['1', '5'] },
      }));
    const groups = useTerms('/');
    await nextTick();
    stores.vocabulary.currentRegisterId = `same-standard-new-${registerNumber}`;
    await settle();
    stores.vocabulary.currentConcept = concept('1');
    await settle();
    const expected = [{
      key: 'iso 704:2022', label: 'New register standard',
      terms: [{ conceptId: '5', designation: '5' }],
    }];
    expect(groups.value).toEqual(expected);

    resolveOld(response(index));
    await settle();
    expect(groups.value).toEqual(expected);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
