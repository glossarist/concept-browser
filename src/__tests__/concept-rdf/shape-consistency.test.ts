import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Parser, Store } from 'n3';

const SHAPES_PATH = join(process.cwd(), 'data', 'concept-model', 'shapes', 'glossarist.shacl.ttl');

const SH = 'http://www.w3.org/ns/shacl#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

function parseShapes(): Store {
  const text = readFileSync(SHAPES_PATH, 'utf8');
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(text));
  return store;
}

let store: Store;

beforeAll(() => {
  store = parseShapes();
});

function allQuads(): any[] {
  return [...(store as any)];
}

function isShapeQuad(q: any): boolean {
  return q.predicate.value === `${RDF}type` && q.object.value === `${SH}NodeShape`;
}

describe('WS P7 — canonical SHACL shape self-consistency', () => {
  it('every sh:NodeShape declares an sh:targetClass', () => {
    const shapes = allQuads().filter(isShapeQuad);
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const targetClasses = (store as any).getObjects(shape.subject, `${SH}targetClass`, null);
      expect(targetClasses.length).toBeGreaterThan(0);
    }
  });

  it('every sh:targetClass IRI uses the gloss: namespace', () => {
    const targets = allQuads()
      .filter((q: any) => q.predicate.value === `${SH}targetClass`)
      .map((q: any) => q.object.value);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.startsWith('https://www.glossarist.org/')).toBe(true);
    }
  });

  it('every sh:datatype references a built-in XSD datatype (when XSD-prefixed)', () => {
    const builtins = new Set([
      `${XSD}string`, `${XSD}integer`, `${XSD}dateTime`, `${XSD}date`, `${XSD}anyURI`,
      `${XSD}boolean`, `${XSD}decimal`, `${XSD}double`, `${XSD}float`,
      `${XSD}nonNegativeInteger`, `${XSD}positiveInteger`, `${XSD}duration`,
    ]);
    const datatypes = allQuads().filter((q: any) => q.predicate.value === `${SH}datatype`);
    expect(datatypes.length).toBeGreaterThan(0);
    for (const dt of datatypes) {
      const value = dt.object.value;
      if (value.startsWith(XSD)) {
        expect(builtins.has(value)).toBe(true);
      }
    }
  });

  it('every sh:property has exactly one sh:path', () => {
    const props = allQuads().filter((q: any) => q.predicate.value === `${SH}property`);
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) {
      const paths = (store as any).getObjects(prop.object, `${SH}path`, null);
      expect(paths.length).toBe(1);
    }
  });

  it('no two NodeShapes share both a target class AND the same predicate path', () => {
    const shapes = allQuads().filter(isShapeQuad);

    const seen = new Map<string, string[]>();
    for (const shape of shapes) {
      const shapeIri = String(shape.subject.value);
      const targetClasses = (store as any)
        .getObjects(shape.subject, `${SH}targetClass`, null)
        .map((t: any) => String(t.value));
      const properties = (store as any).getObjects(shape.subject, `${SH}property`, null);
      const paths: string[] = [];
      for (const prop of properties) {
        const propPaths = (store as any)
          .getObjects(prop, `${SH}path`, null)
          .map((t: any) => String(t.value));
        paths.push(...propPaths);
      }

      for (const tc of targetClasses) {
        for (const p of paths) {
          const key = `${tc}|${p}`;
          const existing = seen.get(key) ?? [];
          existing.push(shapeIri);
          seen.set(key, existing);
        }
      }
    }

    for (const [key, shapeIris] of seen.entries()) {
      if (shapeIris.length > 1) {
        expect.fail(`Conflicting NodeShapes at ${key}: ${shapeIris.join(', ')}`);
      }
    }
  });

  it('no NodeShape has both sh:property and a contradiction (path declared twice)', () => {
    const shapes = allQuads().filter(isShapeQuad);
    for (const shape of shapes) {
      const properties = (store as any).getObjects(shape.subject, `${SH}property`, null);
      const seenPaths = new Set<string>();
      for (const prop of properties) {
        const paths = (store as any).getObjects(prop, `${SH}path`, null).map((t: any) => String(t.value));
        for (const p of paths) {
          expect(seenPaths.has(p)).toBe(false);
          seenPaths.add(p);
        }
      }
    }
  });
});