import { describe, it, expect } from 'vitest';
import { extractYear, deriveSeriesKey, groupManifestsIntoSeries } from '../../composables/useDatasetSeries';
import type { Manifest } from '../../adapters/types';

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    id: 'test',
    title: 'Test',
    ref: 'TEST',
    conceptCount: 0,
    languages: ['eng'],
    sections: [],
    status: 'valid',
    schemaVersion: '1.0',
    lastUpdated: '2026-01-01',
    ...overrides,
  } as unknown as Manifest;
}

describe('extractYear — ISO standard references', () => {
  it('extracts the year from `:YYYY` ISO references', () => {
    expect(extractYear('ISO 10241-1:2011')).toBe(2011);
    expect(extractYear('ISO/IEC 11179-1:2015')).toBe(2015);
    expect(extractYear('ISO 19115:2003')).toBe(2003);
    expect(extractYear('IEC 60050-102:2017')).toBe(2017);
  });

  it('extracts the year from `:YYYYa` ISO references (revision letter)', () => {
    expect(extractYear('ISO 123:2020a')).toBe(2020);
    expect(extractYear('ISO 123:2018A')).toBe(2018);
  });

  it('does NOT match a 4-digit standard number without a colon', () => {
    expect(extractYear('ISO 10241')).toBeUndefined();
    expect(extractYear('ISO 19115')).toBeUndefined();
    expect(extractYear('IEC 60050')).toBeUndefined();
  });
});

describe('extractYear — naming-convention suffix', () => {
  it('extracts the year from `<name>-YYYY` suffix', () => {
    expect(extractYear('viml-2022')).toBe(2022);
    expect(extractYear('viml-1968')).toBe(1968);
  });

  it('extracts the year from `<name>_YYYY` suffix', () => {
    expect(extractYear('viml_2022')).toBe(2022);
  });

  it('extracts the year from `<name> YYYY` suffix', () => {
    expect(extractYear('VIML 1968')).toBe(1968);
  });

  it('extracts the year with revision letter', () => {
    expect(extractYear('viml-2022a')).toBe(2022);
    expect(extractYear('viml-2022A')).toBe(2022);
  });
});

describe('extractYear — bare year', () => {
  it('extracts a bare 4-digit year as the entire string', () => {
    expect(extractYear('2022')).toBe(2022);
    expect(extractYear('  1968  ')).toBe(1968);
  });
});

describe('extractYear — rejection cases', () => {
  it('returns undefined for strings with no year', () => {
    expect(extractYear('VIM')).toBeUndefined();
    expect(extractYear('ISO')).toBeUndefined();
    expect(extractYear('')).toBeUndefined();
  });

  it('returns undefined for 4-digit runs that are out of range', () => {
    expect(extractYear('file-1800')).toBeUndefined();
    expect(extractYear('file-2200')).toBeUndefined();
  });

  it('handles ambiguous strings by preferring ISO `:YYYY` form', () => {
    expect(extractYear('ISO 704:2020 and ISO 10241:2011')).toBe(2011);
  });
});

describe('deriveSeriesKey', () => {
  it('strips trailing -YYYY', () => {
    expect(deriveSeriesKey('viml-2022')).toBe('viml');
    expect(deriveSeriesKey('viml-1968')).toBe('viml');
  });

  it('strips trailing _YYYY', () => {
    expect(deriveSeriesKey('viml_2022')).toBe('viml');
  });

  it('strips trailing :YYYY', () => {
    expect(deriveSeriesKey('iso-704:2020')).toBe('iso-704');
  });

  it('preserves keys without year suffix', () => {
    expect(deriveSeriesKey('iso-704')).toBe('iso-704');
    expect(deriveSeriesKey('viml')).toBe('viml');
  });

  it('handles year+letter suffix', () => {
    expect(deriveSeriesKey('viml-2022a')).toBe('viml');
  });
});

describe('groupManifestsIntoSeries', () => {
  describe('strategy 1 — config-driven lineage series', () => {
    it('uses config when at least one lineage group is configured', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022', status: 'valid' }),
        makeManifest({ id: 'viml-2013', status: 'valid' }),
      ];
      const configured = [{
        id: 'viml',
        label: 'VIML',
        datasets: ['viml-2022', 'viml-2013'],
        kind: 'lineage' as const,
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      expect(series.length).toBe(1);
      expect(series[0].key).toBe('viml');
      expect(series[0].members.length).toBe(2);
      expect(series[0].configured).toBe(true);
    });

    it('includes stub members for datasets whose manifest is not loaded', () => {
      const manifests = [makeManifest({ id: 'viml-2022', status: 'valid' })];
      const configured = [{
        id: 'viml',
        datasets: ['viml-2022', 'viml-2013', 'viml-1968'],
        kind: 'lineage' as const,
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      expect(series[0].members.length).toBe(3);
    });

    it('honors explicit current from config', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022', status: 'valid' }),
        makeManifest({ id: 'viml-2013', status: 'valid' }),
      ];
      const configured = [{
        id: 'viml',
        datasets: ['viml-2013', 'viml-2022'],
        kind: 'lineage' as const,
        current: 'viml-2013',
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      expect(series[0].current?.id).toBe('viml-2013');
    });

    it('falls back to newest valid member when current is unset', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022', status: 'valid' }),
        makeManifest({ id: 'viml-2013', status: 'valid' }),
      ];
      const configured = [{
        id: 'viml',
        datasets: ['viml-2013', 'viml-2022'],
        kind: 'lineage' as const,
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      expect(series[0].current?.id).toBe('viml-2022');
    });

    it('sorts members by year ascending', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022', status: 'valid' }),
        makeManifest({ id: 'viml-1968', status: 'withdrawn' }),
        makeManifest({ id: 'viml-2013', status: 'valid' }),
      ];
      const configured = [{
        id: 'viml',
        datasets: ['viml-2022', 'viml-1968', 'viml-2013'],
        kind: 'lineage' as const,
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      const years = series[0].members.map(m => m.year);
      expect(years).toEqual([1968, 2013, 2022]);
    });
  });

  describe('strategy 2 — auto-derive by naming convention', () => {
    it('groups by stripped key when no config is provided', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022', status: 'valid' }),
        makeManifest({ id: 'viml-2013', status: 'valid' }),
        makeManifest({ id: 'iso-geodetic', status: 'valid' }),
      ];
      const series = groupManifestsIntoSeries(manifests, undefined, []);
      expect(series.length).toBe(2);
      const viml = series.find(s => s.key === 'viml');
      expect(viml?.members.length).toBe(2);
      expect(viml?.configured).toBe(false);
    });

    it('sorts groups alphabetically', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022' }),
        makeManifest({ id: 'iso-geodetic' }),
      ];
      const series = groupManifestsIntoSeries(manifests, undefined, []);
      expect(series.map(s => s.key)).toEqual(['iso-geodetic', 'viml']);
    });

    it('picks newest valid as current in auto-derived mode', () => {
      const manifests = [
        makeManifest({ id: 'viml-2013', status: 'valid' }),
        makeManifest({ id: 'viml-2022', status: 'valid' }),
      ];
      const series = groupManifestsIntoSeries(manifests, undefined, []);
      expect(series[0].current?.id).toBe('viml-2022');
    });
  });

  describe('strategy selection', () => {
    it('picks strategy 1 when at least one configured lineage group exists', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022' }),
        makeManifest({ id: 'viml-2013' }),
        makeManifest({ id: 'iso-geodetic' }),
      ];
      const configured = [{
        id: 'viml',
        datasets: ['viml-2022', 'viml-2013'],
        kind: 'lineage' as const,
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      // Strategy 1 → only `viml` group, no auto-derive
      expect(series.length).toBe(1);
      expect(series[0].key).toBe('viml');
    });

    it('falls through to strategy 2 when no configured lineage groups exist', () => {
      const manifests = [
        makeManifest({ id: 'viml-2022' }),
        makeManifest({ id: 'viml-2013' }),
      ];
      const configured = [{
        id: 'topic-group',
        datasets: ['viml-2022', 'viml-2013'],
        kind: 'topic' as const,
      }];
      const series = groupManifestsIntoSeries(manifests, undefined, configured);
      expect(series.some(s => !s.configured)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('empty manifests array returns empty series array', () => {
      expect(groupManifestsIntoSeries([], undefined, [])).toEqual([]);
    });

    it('empty config falls through to strategy 2', () => {
      const manifests = [makeManifest({ id: 'viml-2022' }), makeManifest({ id: 'viml-2013' })];
      const series = groupManifestsIntoSeries(manifests, undefined, []);
      expect(series[0].key).toBe('viml');
    });
  });
});