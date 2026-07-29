/**
 * GenericRelationList mount test — pins the wire-type contract so
 * the 5 type bugs found in audit (entry.titles, member.ref,
 * is_delimiting casing, comprehensive.source, missing props)
 * can't regress.
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import GenericRelationList from '../../components/GenericRelationList.vue';
import type { GenericRelationWire } from '../../adapters/types';

// Stub the composables the component depends on
vi.mock('../../stores/vocabulary', () => ({
  useVocabularyStore: () => ({
    graph: { getNode: () => null },
    datasets: new Map(),
  }),
}));

vi.mock('../../adapters/factory', () => ({
  getFactory: () => ({
    resolve: (uri: string) => ({ type: 'unresolved' as const, uri }),
  }),
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  locale: { value: 'eng' },
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const manifest = {
  id: 'test',
  datasetUri: 'https://example.org/test',
  title: 'Test',
  description: '',
  owner: '',
  baseUrl: '',
  languages: ['eng'],
  conceptCount: 0,
  conceptUrlTemplate: '',
  indexUrl: '',
  contextUrl: '',
  uriBase: 'https://example.org',
  status: 'valid',
  schemaVersion: '3',
  tags: [],
  lastUpdated: '',
  sourceRepo: '',
  chunkSize: 100,
} as any;

function makeRelation(overrides: Partial<GenericRelationWire> = {}): GenericRelationWire {
  return {
    source: 'https://example.org/test/concept/5-1',
    comprehensive: 'https://example.org/test/concept/5-1',
    members: [
      { uri: 'https://example.org/test/concept/5-4', presence: 'required', count: 'exactly_one', isDelimiting: false },
      { uri: 'https://example.org/test/concept/5-5', presence: 'required', count: 'exactly_one', isDelimiting: false },
    ],
    completeness: 'complete',
    register: 'test',
    ...overrides,
  };
}

describe('GenericRelationList — wire-type contract mount test', () => {
  it('mounts without errors for a well-formed relation', () => {
    const w = mount(GenericRelationList, {
      props: {
        relations: [makeRelation()],
        manifest,
        registerId: 'test',
      },
    });
    expect(w.html()).toContain('generic-relation-card');
  });

  it('renders completeness badge', () => {
    const w = mount(GenericRelationList, {
      props: {
        relations: [makeRelation({ completeness: 'partial' })],
        manifest,
        registerId: 'test',
      },
    });
    expect(w.html()).toContain('completeness-partial');
  });

  it('renders multiple relations', () => {
    const w = mount(GenericRelationList, {
      props: {
        relations: [
          makeRelation({ comprehensive: 'https://example.org/test/concept/5-1' }),
          makeRelation({ comprehensive: 'https://example.org/test/concept/5-2' }),
        ],
        manifest,
        registerId: 'test',
      },
    });
    expect(w.findAll('.generic-relation-card')).toHaveLength(2);
  });

  it('renders criterion when present', () => {
    const w = mount(GenericRelationList, {
      props: {
        relations: [makeRelation({ criterion: { eng: 'by realization medium' } })],
        manifest,
        registerId: 'test',
      },
    });
    expect(w.html()).toContain('by realization medium');
  });

  it('renders member presence/count badges for non-default values', () => {
    const w = mount(GenericRelationList, {
      props: {
        relations: [makeRelation({
          members: [
            { uri: 'https://example.org/test/concept/5-4', presence: 'optional', count: 'multiple', isDelimiting: true },
            { uri: 'https://example.org/test/concept/5-5', presence: 'required', count: 'exactly_one', isDelimiting: false },
          ],
        })],
        manifest,
        registerId: 'test',
      },
    });
    const html = w.html();
    expect(html).toContain('Optional');
    expect(html).toContain('Multiple');
  });

  it('renders empty section when relations array is empty', () => {
    const w = mount(GenericRelationList, {
      props: {
        relations: [],
        manifest,
        registerId: 'test',
      },
    });
    expect(w.find('section.generic-relations').exists()).toBe(true);
    expect(w.findAll('.generic-relation-card')).toHaveLength(0);
  });
});
