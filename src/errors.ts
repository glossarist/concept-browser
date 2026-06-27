export interface ErrorContext {
  readonly conceptId?: string;
  readonly registerId?: string;
  readonly locale?: string;
  readonly predicate?: string;
  readonly sourcePath?: string;
  readonly cause?: unknown;
  readonly [key: string]: unknown;
}

export class GlossaristError extends Error {
  constructor(
    message: string,
    public readonly context: ErrorContext = {},
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  hint(): string {
    return '';
  }
}

export class ConfigurationError extends GlossaristError {}
export class DataSourceError extends GlossaristError {}
export class SerializationError extends GlossaristError {}
export class ValidationError extends GlossaristError {}

export class UnknownDatasetError extends ConfigurationError {
  static make(registerId: string): UnknownDatasetError {
    return new UnknownDatasetError(`Unknown dataset: ${registerId}`, { registerId });
  }

  hint(): string {
    return 'Check datasets.yml / datasets.json registration and adapter discovery.';
  }
}

export class DatasetRegistryLoadError extends DataSourceError {
  static make(status: number, url?: string): DatasetRegistryLoadError {
    return new DatasetRegistryLoadError(
      `Failed to load dataset registry: HTTP ${status}`,
      { status, url },
    );
  }
}

export class ManifestLoadError extends DataSourceError {
  static make(registerId: string, status: number): ManifestLoadError {
    return new ManifestLoadError(
      `Failed to load manifest for ${registerId}: HTTP ${status}`,
      { registerId, status },
    );
  }
}

export class IndexLoadError extends DataSourceError {
  static make(registerId: string, status: number): IndexLoadError {
    return new IndexLoadError(
      `Failed to load index for ${registerId}: HTTP ${status}`,
      { registerId, status },
    );
  }
}

export class ChunkLoadError extends DataSourceError {
  static make(registerId: string, chunkIndex: number, status: number): ChunkLoadError {
    return new ChunkLoadError(
      `Failed to load chunk ${chunkIndex} for ${registerId}: HTTP ${status}`,
      { registerId, chunkIndex, status },
    );
  }
}

export class ConceptNotFoundError extends DataSourceError {
  static make(registerId: string, conceptId: string): ConceptNotFoundError {
    return new ConceptNotFoundError(
      `Concept ${conceptId} not found in ${registerId}`,
      { registerId, conceptId },
    );
  }
}

export class NonVerbalEntityNotFoundError extends DataSourceError {
  static make(datasetId: string, kind: string, entityId: string, status: number): NonVerbalEntityNotFoundError {
    return new NonVerbalEntityNotFoundError(
      `Failed to load ${kind} ${entityId} from ${datasetId}: HTTP ${status}`,
      { datasetId, kind, entityId, status },
    );
  }
}

export class InvalidConceptIdentityError extends SerializationError {
  hint(): string {
    return 'ConceptIdentity requires non-empty localId, registerId, and uriBase.';
  }
}

export class InvalidConceptUriError extends SerializationError {
  static make(uri: string): InvalidConceptUriError {
    return new InvalidConceptUriError(`Not a concept URI: ${uri}`, { uri });
  }

  hint(): string {
    return 'Expected format: <uriBase>/<registerId>/concept/<conceptId>';
  }
}

export class InvalidLangTagError extends SerializationError {
  hint(): string {
    return 'Use BCP-47 form: primary[-script][-region][-variant]*[-x-private]. ' +
      'ISO 639-3 codes (eng, fra) are normalized to ISO 639-1 (en, fr).';
  }
}

export function isGlossaristError(err: unknown): err is GlossaristError {
  return err instanceof GlossaristError;
}

export function formatError(err: GlossaristError): string {
  const lines = [`${err.name}: ${err.message}`];
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(err.context)) {
    if (k === 'cause' || v === undefined || v === null) continue;
    fields[k] = v;
  }
  if (Object.keys(fields).length) {
    for (const [k, v] of Object.entries(fields)) {
      lines.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  }
  const h = err.hint();
  if (h) lines.push(`  hint: ${h}`);
  return lines.join('\n');
}
