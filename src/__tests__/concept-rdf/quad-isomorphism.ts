import { Parser, Store } from 'n3';

export interface CanonicalizedQuads {
  readonly size: number;
  readonly quads: ReadonlySet<string>;
}

function quadSignature(subject: string, predicate: string, objectValue: string, objectType: string): string {
  return `${subject}|${predicate}|${objectValue}|${objectType}`;
}

function termToString(term: { termType: string; value: string }): string {
  if (term.termType === 'BlankNode') return '_:b';
  return `${term.termType}:${term.value}`;
}

export function canonicalizeQuads(turtle: string): CanonicalizedQuads {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  const sigs = new Set<string>();
  store.forEach(q => {
    sigs.add(quadSignature(
      termToString(q.subject as any),
      q.predicate.value,
      termToString(q.object as any),
      q.object.termType,
    ));
  });
  return { size: sigs.size, quads: sigs };
}

export interface DiffResult {
  readonly isomorphic: boolean;
  readonly jsOnly: readonly string[];
  readonly rubyOnly: readonly string[];
}

export function diffQuadSets(js: CanonicalizedQuads, ruby: CanonicalizedQuads): DiffResult {
  const jsOnly = [...js.quads].filter(q => !ruby.quads.has(q));
  const rubyOnly = [...ruby.quads].filter(q => !js.quads.has(q));
  return {
    isomorphic: jsOnly.length === 0 && rubyOnly.length === 0,
    jsOnly,
    rubyOnly,
  };
}