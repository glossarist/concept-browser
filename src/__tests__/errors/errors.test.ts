import { describe, it, expect } from 'vitest';
import {
  GlossaristError,
  ConfigurationError,
  DataSourceError,
  SerializationError,
  ValidationError,
  UnknownDatasetError,
  DatasetRegistryLoadError,
  ManifestLoadError,
  IndexLoadError,
  ChunkLoadError,
  ConceptNotFoundError,
  NonVerbalEntityNotFoundError,
  InvalidConceptIdentityError,
  InvalidConceptUriError,
  formatError,
  isGlossaristError,
} from '../../errors';

describe('GlossaristError hierarchy', () => {
  it('preserves the constructor name as Error#name', () => {
    const err = new UnknownDatasetError('foo', { registerId: 'foo' });
    expect(err.name).toBe('UnknownDatasetError');
  });

  it('attaches the context object verbatim', () => {
    const err = ConceptNotFoundError.make('iso1', '3.1.1');
    expect(err.context.registerId).toBe('iso1');
    expect(err.context.conceptId).toBe('3.1.1');
  });

  it('branches inherit from the correct top-level class', () => {
    expect(new UnknownDatasetError('x')).toBeInstanceOf(ConfigurationError);
    expect(ConceptNotFoundError.make('r', 'c')).toBeInstanceOf(DataSourceError);
    expect(new InvalidConceptIdentityError('bad')).toBeInstanceOf(SerializationError);
    expect(new ValidationError('bad')).toBeInstanceOf(GlossaristError);
  });

  it('all errors are instanceof GlossaristError and Error', () => {
    const cases = [
      new UnknownDatasetError('x'),
      new DataSourceError('x'),
      new SerializationError('x'),
      new ValidationError('x'),
    ];
    for (const err of cases) {
      expect(err).toBeInstanceOf(GlossaristError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});

describe('factories', () => {
  it('UnknownDatasetError.make produces a descriptive message', () => {
    const err = UnknownDatasetError.make('iso-foobar');
    expect(err.message).toContain('iso-foobar');
    expect(err.context.registerId).toBe('iso-foobar');
    expect(err.hint()).toMatch(/datasets/i);
  });

  it('DatasetRegistryLoadError.make captures status and URL', () => {
    const err = DatasetRegistryLoadError.make(503, '/datasets.json');
    expect(err.context.status).toBe(503);
    expect(err.context.url).toBe('/datasets.json');
  });

  it('ManifestLoadError and IndexLoadError tag registerId', () => {
    expect(ManifestLoadError.make('iso1', 500).context.registerId).toBe('iso1');
    expect(IndexLoadError.make('iso1', 404).context.registerId).toBe('iso1');
  });

  it('ChunkLoadError records chunk index', () => {
    const err = ChunkLoadError.make('iso1', 3, 500);
    expect(err.context.chunkIndex).toBe(3);
  });

  it('ConceptNotFoundError formats a stable message', () => {
    const err = ConceptNotFoundError.make('iso1', '3.1.1');
    expect(err.message).toBe('Concept 3.1.1 not found in iso1');
  });

  it('NonVerbalEntityNotFoundError captures kind and id', () => {
    const err = NonVerbalEntityNotFoundError.make('iso1', 'figure', 'fig-1', 404);
    expect(err.context.kind).toBe('figure');
    expect(err.context.entityId).toBe('fig-1');
  });

  it('InvalidConceptUriError.make formats a hint', () => {
    const err = InvalidConceptUriError.make('https://example.com/foo');
    expect(err.context.uri).toBe('https://example.com/foo');
    expect(err.hint()).toContain('<uriBase>');
  });

  it('InvalidConceptIdentityError provides a hint', () => {
    const err = new InvalidConceptIdentityError('bad');
    expect(err.hint()).toMatch(/localId/);
  });
});

describe('formatError', () => {
  it('starts with the class name and message', () => {
    const out = formatError(ConceptNotFoundError.make('iso1', '3.1.1'));
    expect(out.split('\n')[0]).toBe('ConceptNotFoundError: Concept 3.1.1 not found in iso1');
  });

  it('renders context fields one per line', () => {
    const out = formatError(ManifestLoadError.make('iso1', 500));
    expect(out).toContain('registerId: iso1');
    expect(out).toContain('status: 500');
  });

  it('appends the hint when present', () => {
    const out = formatError(UnknownDatasetError.make('iso1'));
    expect(out).toContain('hint:');
  });

  it('omits empty context', () => {
    const out = formatError(new ValidationError('boom'));
    expect(out).toBe('ValidationError: boom');
  });

  it('omits undefined fields but keeps zero/false values', () => {
    const err = new ValidationError('boom', { count: 0, flag: false, missing: undefined });
    const out = formatError(err);
    expect(out).toContain('count: 0');
    expect(out).toContain('flag: false');
    expect(out).not.toContain('missing');
  });
});

describe('isGlossaristError', () => {
  it('returns true for any subclass of GlossaristError', () => {
    expect(isGlossaristError(ConceptNotFoundError.make('r', 'c'))).toBe(true);
  });

  it('returns false for plain Errors and non-errors', () => {
    expect(isGlossaristError(new Error('plain'))).toBe(false);
    expect(isGlossaristError(null)).toBe(false);
    expect(isGlossaristError('string')).toBe(false);
  });
});
