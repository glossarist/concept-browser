/**
 * RDF intermediate representation — a subject-grouped triple graph.
 *
 * The graph is the single source of truth for all RDF emission. The
 * ConceptEmitter walks the Concept model and populates an RdfGraph; the
 * Turtle/JSON-LD writers and the UI sections builder all consume the
 * same graph. Adding a new field touches exactly one site (the emitter),
 * not three.
 *
 * Terms use prefixed names (`gloss:Concept`) or absolute IRIs
 * (`https://glossarist.org/...`). Writers decide how to render each.
 */

export type RdfTerm = RdfIri | RdfLiteral | RdfBlankNode;

export interface RdfIri {
  readonly kind: 'iri';
  readonly value: string;
}

export interface RdfLiteral {
  readonly kind: 'literal';
  readonly value: string;
  readonly lang?: string;
  readonly datatype?: string;
}

export interface RdfBlankNode {
  readonly kind: 'blank';
  readonly triples: RdfTriple[];
}

export interface RdfTriple {
  readonly predicate: string;
  readonly object: RdfTerm;
}

export interface RdfResource {
  readonly subject: string;
  readonly types: readonly string[];
  readonly triples: readonly RdfTriple[];
  readonly label: string;
  readonly classLabel: string;
  readonly classId: string;
}

interface MutableResource {
  readonly subject: string;
  readonly types: string[];
  readonly triples: RdfTriple[];
  label: string;
  classLabel: string;
  classId: string;
}

export interface ResourceInit {
  readonly types?: readonly string[];
  readonly label?: string;
  readonly classLabel?: string;
  readonly classId?: string;
}

export function lit(value: string, opts: { lang?: string; datatype?: string } = {}): RdfLiteral {
  return { kind: 'literal', value, lang: opts.lang, datatype: opts.datatype };
}

export function iri(value: string): RdfIri {
  return { kind: 'iri', value };
}

export function blank(...triples: RdfTriple[]): RdfBlankNode {
  return { kind: 'blank', triples };
}

export function triple(predicate: string, object: RdfTerm): RdfTriple {
  return { predicate, object };
}

export function termEquals(a: RdfTerm, b: RdfTerm): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'iri':
      return a.value === (b as RdfIri).value;
    case 'literal': {
      const o = b as RdfLiteral;
      return a.value === o.value && a.lang === o.lang && a.datatype === o.datatype;
    }
    case 'blank': {
      const o = b as RdfBlankNode;
      if (a.triples.length !== o.triples.length) return false;
      return a.triples.every((t, i) => {
        const u = o.triples[i];
        return t.predicate === u.predicate && termEquals(t.object, u.object);
      });
    }
  }
}

export class RdfGraph {
  private readonly _resources = new Map<string, MutableResource>();
  private readonly _order: string[] = [];

  declare(subject: string, init: ResourceInit = {}): ResourceWriter {
    let r = this._resources.get(subject);
    if (!r) {
      r = {
        subject,
        types: [...(init.types ?? [])],
        triples: [],
        label: init.label ?? subject,
        classLabel: init.classLabel ?? '',
        classId: init.classId ?? '',
      };
      this._resources.set(subject, r);
      this._order.push(subject);
    } else {
      if (init.types) {
        for (const t of init.types) {
          if (!r.types.includes(t)) r.types.push(t);
        }
      }
      if (init.label !== undefined && r.label === subject) r.label = init.label;
      if (init.classLabel && !r.classLabel) r.classLabel = init.classLabel;
      if (init.classId && !r.classId) r.classId = init.classId;
    }
    return new ResourceWriter(r.triples);
  }

  has(subject: string): boolean {
    return this._resources.has(subject);
  }

  get(subject: string): RdfResource | undefined {
    return this._resources.get(subject);
  }

  get size(): number {
    return this._order.length;
  }

  *resources(): Iterable<RdfResource> {
    for (const s of this._order) {
      yield this._resources.get(s)!;
    }
  }

  toArray(): RdfResource[] {
    return Array.from(this.resources());
  }

  merge(other: RdfGraph): this {
    for (const r of other.resources()) {
      const w = this.declare(r.subject, {
        types: [...r.types],
        label: r.label,
        classLabel: r.classLabel,
        classId: r.classId,
      });
      for (const t of r.triples) {
        if (t.object.kind === 'iri') w.iri(t.predicate, t.object.value);
        else if (t.object.kind === 'literal') {
          w.literal(t.predicate, t.object.value, { lang: t.object.lang, datatype: t.object.datatype });
        } else {
          w.blank(t.predicate, t.object.triples);
        }
      }
    }
    return this;
  }
}

export class ResourceWriter {
  constructor(private readonly triples: RdfTriple[]) {}

  add(predicate: string, object: RdfTerm): this {
    if (object.kind === 'literal' && object.value === '') return this;
    if (object.kind === 'iri' && object.value === '') return this;
    if (!this.triples.some(t => t.predicate === predicate && termEquals(t.object, object))) {
      this.triples.push({ predicate, object });
    }
    return this;
  }

  literal(predicate: string, value: string, opts: { lang?: string; datatype?: string } = {}): this {
    if (!value) return this;
    return this.add(predicate, { kind: 'literal', value, lang: opts.lang, datatype: opts.datatype });
  }

  iri(predicate: string, value: string): this {
    if (!value) return this;
    return this.add(predicate, { kind: 'iri', value });
  }

  blank(predicate: string, triples: readonly RdfTriple[]): this {
    if (triples.length === 0) return this;
    return this.add(predicate, { kind: 'blank', triples: [...triples] });
  }

  addTriple(t: RdfTriple): this {
    return this.add(t.predicate, t.object);
  }

  addTriples(triples: readonly RdfTriple[]): this {
    for (const t of triples) this.addTriple(t);
    return this;
  }
}

export function isAbsoluteIri(s: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || s.startsWith('urn:');
}
