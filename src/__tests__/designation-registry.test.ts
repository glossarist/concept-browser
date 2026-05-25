import { describe, it, expect } from 'vitest';
import { Expression, Abbreviation } from 'glossarist';
import {
  designationTypeInfo,
  normativeStatusInfo,
  abbreviationDetails,
  grammarBadges,
  pronunciationLabel,
  pronunciationTooltip,
  termTypeInfo,
  sourceStatusInfo,
  sourceTypeInfo,
} from '../utils/designation-registry';

describe('designationTypeInfo', () => {
  it('returns info for expression', () => {
    const d = Expression.fromJSON({ type: 'expression', designation: 'test' });
    const info = designationTypeInfo(d);
    expect(info.label).toBe('expression');
    expect(info.color).toContain('sky');
  });

  it('returns info for abbreviation', () => {
    const d = Abbreviation.fromJSON({ type: 'abbreviation', designation: 'ISO' });
    const info = designationTypeInfo(d);
    expect(info.label).toBe('abbreviation');
    expect(info.color).toContain('amber');
  });

  it('returns info for symbol with broader hierarchy', () => {
    const d = { type: 'letter_symbol', designation: 'x' } as any;
    const info = designationTypeInfo(d);
    expect(info.label).toBe('letter symbol');
  });

  it('returns fallback for unknown type', () => {
    const d = { type: 'custom', designation: 'x' } as any;
    const info = designationTypeInfo(d);
    expect(info.label).toBe('custom');
  });
});

describe('normativeStatusInfo', () => {
  it('returns preferred', () => {
    const info = normativeStatusInfo('preferred');
    expect(info.label).toBe('preferred');
    expect(info.color).toContain('emerald');
  });

  it('returns deprecated', () => {
    const info = normativeStatusInfo('deprecated');
    expect(info.label).toBe('deprecated');
    expect(info.color).toContain('red');
  });

  it('returns empty for null', () => {
    const info = normativeStatusInfo(null);
    expect(info.label).toBe('');
  });
});

describe('sourceStatusInfo', () => {
  it('returns identical status', () => {
    const info = sourceStatusInfo('identical');
    expect(info.label).toBe('identical');
  });

  it('returns modified status', () => {
    const info = sourceStatusInfo('modified');
    expect(info.label).toBe('modified');
    expect(info.definition).toBeTruthy();
  });

  it('returns empty for null', () => {
    const info = sourceStatusInfo(null);
    expect(info.label).toBe('');
  });
});

describe('sourceTypeInfo', () => {
  it('returns authoritative', () => {
    const info = sourceTypeInfo('authoritative');
    expect(info.label).toBe('authoritative');
    expect(info.color).toContain('purple');
  });

  it('returns lineage', () => {
    const info = sourceTypeInfo('lineage');
    expect(info.label).toBe('lineage');
    expect(info.color).toContain('blue');
  });
});

describe('termTypeInfo', () => {
  it('returns term type with definition', () => {
    const info = termTypeInfo('acronym');
    expect(info.label).toBe('acronym');
    expect(info.definition).toBeTruthy();
    expect(info.category).toBe('abbreviation');
  });

  it('returns empty for null', () => {
    const info = termTypeInfo(null);
    expect(info.label).toBe('');
  });
});

describe('abbreviationDetails', () => {
  it('identifies acronym', () => {
    const d = Abbreviation.fromJSON({ type: 'abbreviation', designation: 'ISO', acronym: true });
    expect(abbreviationDetails(d)).toContain('acronym');
    expect(abbreviationDetails(d)).not.toContain('initialism');
  });

  it('identifies initialism', () => {
    const d = Abbreviation.fromJSON({ type: 'abbreviation', designation: 'UN', initialism: true });
    expect(abbreviationDetails(d)).toContain('initialism');
  });

  it('identifies truncation', () => {
    const d = Abbreviation.fromJSON({ type: 'abbreviation', designation: 'info', truncation: true });
    expect(abbreviationDetails(d)).toContain('truncation');
  });
});

describe('grammarBadges', () => {
  it('returns gender badge with ontology label', () => {
    const d = Expression.fromJSON({ type: 'expression', designation: 'test', grammar_info: [{ gender: 'f' }] });
    const badges = grammarBadges((d as any).grammarInfo[0]);
    expect(badges).toEqual([{ label: 'feminine', definition: 'Feminine grammatical gender.' }]);
  });

  it('returns gender and number badges', () => {
    const d = Expression.fromJSON({ type: 'expression', designation: 'test', grammar_info: [{ gender: 'm', number: 'singular' }] });
    const badges = grammarBadges((d as any).grammarInfo[0]);
    expect(badges[0].label).toBe('masculine');
    expect(badges[1].label).toBe('singular');
  });
});

describe('pronunciationLabel', () => {
  it('shows content with system', () => {
    const p = { content: '/tɛst/', system: 'IPA', language: null, script: null, country: null } as any;
    expect(pronunciationLabel(p)).toBe('/tɛst/ (IPA)');
  });

  it('shows content only', () => {
    const p = { content: '/t/', system: null, language: null, script: null, country: null } as any;
    expect(pronunciationLabel(p)).toBe('/t/');
  });
});

describe('pronunciationTooltip', () => {
  it('includes all metadata', () => {
    const p = { content: '/t/', system: 'IPA', language: 'en', script: 'Latn', country: 'US' } as any;
    const tip = pronunciationTooltip(p);
    expect(tip).toContain('Language: en');
    expect(tip).toContain('System: IPA');
    expect(tip).toContain('Country: US');
  });
});
