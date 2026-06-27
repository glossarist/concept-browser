import { InvalidConceptIdentityError, InvalidConceptUriError } from '../errors';

export interface ConceptIdentityParts {
  readonly localId: string;
  readonly registerId: string;
  readonly uriBase: string;
}

const CONCEPT_URI_RE = /^(.+)\/([^/]+)\/concept\/(.+)$/;

export class ConceptIdentity implements ConceptIdentityParts {
  private readonly _uri: string;
  private readonly _slug: string;
  private readonly _path: string;

  constructor(
    public readonly localId: string,
    public readonly registerId: string,
    public readonly uriBase: string,
  ) {
    if (!localId || !registerId || !uriBase) {
      throw new InvalidConceptIdentityError(
        'ConceptIdentity requires non-empty localId, registerId, and uriBase',
        { localId, registerId, uriBase },
      );
    }
    this._uri = `${uriBase}/${registerId}/concept/${localId}`;
    this._slug = localId;
    this._path = `${registerId}/concepts/${localId}`;
  }

  get uri(): string { return this._uri; }
  get slug(): string { return this._slug; }
  get path(): string { return this._path; }

  equals(other: ConceptIdentity): boolean {
    return this._uri === other._uri;
  }

  toString(): string { return this._uri; }

  toJSON(): ConceptIdentityParts {
    return { localId: this.localId, registerId: this.registerId, uriBase: this.uriBase };
  }

  localizationUri(lang: string): string {
    return `${this._uri}/${lang}`;
  }

  designationUri(lang: string, slug: string): string {
    return `${this._uri}/${lang}/desig/${slug}`;
  }

  domainUri(domainSlug: string): string {
    return `${this.uriBase}/${this.registerId}/domain/${domainSlug}`;
  }

  static fromUri(uri: string): ConceptIdentity {
    const m = uri.match(CONCEPT_URI_RE);
    if (!m) {
      throw InvalidConceptUriError.make(uri);
    }
    return new ConceptIdentity(m[3], m[2], m[1]);
  }

  static isConceptUri(uri: string): boolean {
    return CONCEPT_URI_RE.test(uri);
  }
}
