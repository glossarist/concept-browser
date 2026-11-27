import { describe, it, expect } from 'vitest';
import {
  collectCurationFlags,
  buildCurationReport,
  type CurationEntry,
} from '../lib/curation';

const LANGS = ['eng', 'fra', 'deu'];

function entry(id: string, overrides: Partial<CurationEntry> = {}): CurationEntry {
  return {
    id,
    designation: `term ${id}`,
    flags: collectCurationFlags({ eng: { terms: [{ designation: `term ${id}` }] } }, LANGS),
    ...overrides,
  };
}

describe('collectCurationFlags', () => {
  it('flags every configured language without terms', () => {
    const flags = collectCurationFlags(
      { eng: { terms: [{ designation: 'only english' }] } },
      LANGS,
    );
    expect(flags.missingLanguages).toEqual(['fra', 'deu']);
  });

  it('does not flag languages with terms, even without a definition', () => {
    const flags = collectCurationFlags(
      {
        eng: { terms: [{ designation: 'a' }], definition: 'def' },
        fra: { terms: [{ designation: 'b' }] },
        deu: { terms: [{ designation: 'c' }] },
      },
      LANGS,
    );
    expect(flags.missingLanguages).toEqual([]);
  });

  it('treats empty terms arrays as missing', () => {
    const flags = collectCurationFlags(
      { eng: { terms: [] }, fra: { terms: [{ designation: 'b' }] }, deu: {} },
      LANGS,
    );
    expect(flags.missingLanguages).toEqual(['eng', 'deu']);
  });

  it('treats a missing language entry as missing translation', () => {
    const flags = collectCurationFlags({ eng: { terms: [{ designation: 'a' }] } }, LANGS);
    expect(flags.missingLanguages).toEqual(['fra', 'deu']);
  });

  it('detects concept-level sources', () => {
    const flags = collectCurationFlags(
      { _sources: [{ type: 'authoritative' }], eng: { terms: [{ designation: 'a' }] } },
      LANGS,
    );
    expect(flags.noSources).toBe(false);
  });

  it('detects per-language sources', () => {
    const flags = collectCurationFlags(
      { eng: { terms: [{ designation: 'a' }], sources: [{ type: 'authoritative' }] } },
      LANGS,
    );
    expect(flags.noSources).toBe(false);
  });

  it('flags entries with no sources anywhere', () => {
    const flags = collectCurationFlags(
      { eng: { terms: [{ designation: 'a' }] }, fra: { terms: [{ designation: 'b' }] } },
      LANGS,
    );
    expect(flags.noSources).toBe(true);
  });

  it('flags noSources for entries with empty source arrays', () => {
    const flags = collectCurationFlags(
      { _sources: [], eng: { terms: [{ designation: 'a' }], sources: [] } },
      LANGS,
    );
    expect(flags.noSources).toBe(true);
  });
});

describe('buildCurationReport', () => {
  it('routes entries into the right queues with counts', () => {
    const report = buildCurationReport('viml-2022', 3, LANGS, [
      entry('a', {
        flags: { missingLanguages: ['fra', 'deu'], noSources: true },
      }),
      entry('b', {
        parseError: 'canonical parse failed: missing definition',
        flags: collectCurationFlags(
          {
            _sources: [{ type: 'authoritative' }],
            eng: { terms: [{ designation: 'b' }] },
            fra: { terms: [{ designation: 'b' }] },
            deu: { terms: [{ designation: 'b' }] },
          },
          LANGS,
        ),
      }),
      entry('c', {
        flags: collectCurationFlags(
          {
            _sources: [{ type: 'authoritative' }],
            eng: { terms: [{ designation: 'c' }] },
            fra: { terms: [{ designation: 'c' }] },
            deu: { terms: [{ designation: 'c' }] },
          },
          LANGS,
        ),
      }),
    ]);
    expect(report.registerId).toBe('viml-2022');
    expect(report.conceptCount).toBe(3);
    expect(report.validation.count).toBe(1);
    expect(report.validation.items[0].id).toBe('b');
    expect(report.validation.items[0].reason).toContain('canonical parse');
    expect(report.missingTranslations.count).toBe(1);
    expect(report.missingTranslations.items[0].missing).toEqual(['fra', 'deu']);
    expect(report.noSources.count).toBe(1);
    expect(report.noSources.items[0].id).toBe('a');
  });

  it('adds unparseable files to the validation queue', () => {
    const report = buildCurationReport('r', 1, ['eng'], [], ['broken.yaml']);
    expect(report.validation.count).toBe(1);
    expect(report.validation.items[0]).toEqual({
      id: 'broken.yaml',
      designation: '',
      reason: 'source file could not be parsed',
    });
  });

  it('sorts each queue by id for deterministic output', () => {
    const noFlags = { missingLanguages: [] as string[], noSources: false };
    const report = buildCurationReport('r', 3, LANGS, [
      entry('c', { flags: noFlags, parseError: 'x' }),
      entry('a', { flags: noFlags, parseError: 'x' }),
      entry('b', { flags: noFlags, parseError: 'x' }),
    ]);
    expect(report.validation.items.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('reports all-clear queues as zero counts with empty items', () => {
    const report = buildCurationReport('r', 2, ['eng'], [
      entry('a', { flags: { missingLanguages: [], noSources: false } }),
      entry('b', { flags: { missingLanguages: [], noSources: false } }),
    ]);
    expect(report.validation).toEqual({ count: 0, items: [] });
    expect(report.missingTranslations).toEqual({ count: 0, items: [] });
    expect(report.noSources).toEqual({ count: 0, items: [] });
  });

  it('carries languages and conceptCount through for the UI header', () => {
    const report = buildCurationReport('r', 7, LANGS, []);
    expect(report.languages).toEqual(LANGS);
    expect(report.conceptCount).toBe(7);
  });
});
