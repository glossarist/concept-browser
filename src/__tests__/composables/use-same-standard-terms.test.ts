import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, shallowReactive, type EffectScope } from 'vue';
import { Concept } from 'glossarist';
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
      currentAdapter: { getIndexEntry: (id: string) => summaries.get(id) },
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
