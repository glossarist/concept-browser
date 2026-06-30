import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser as N3Parser, DataFactory } from 'n3';
import rdfDataset from '@rdfjs/dataset';
import ShaclValidator from 'rdf-validate-shacl';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { emitVocabularyGraph } from '../../components/concept-rdf/vocabulary-emitter';
import { CONCEPT_FIXTURES } from '../__fixtures__/concepts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHAPES_PATH = join(__dirname, '..', '..', '..', 'data', 'concept-model', 'shapes', 'glossarist.shacl.ttl');

const FACTORY = {
  namedNode: DataFactory.namedNode,
  blankNode: DataFactory.blankNode,
  literal: DataFactory.literal,
  defaultGraph: DataFactory.defaultGraph,
  quad: DataFactory.quad,
  fromTerm: DataFactory.fromTerm,
  fromQuad: DataFactory.fromQuad,
  dataset: rdfDataset.dataset.bind(rdfDataset),
};

const ShaclValidatorCtor = (ShaclValidator as any).default ?? ShaclValidator;

async function parseTurtle(text: string, baseIri: string) {
  const parser = new N3Parser({ baseIRI: baseIri });
  const out = FACTORY.dataset();
  return new Promise((resolve, reject) => {
    parser.parse(text, (err: Error | null, quad: any) => {
      if (err) reject(err);
      else if (quad) out.add(quad);
      else resolve(out);
    });
  });
}

let validator: InstanceType<typeof ShaclValidatorCtor>;
let vocabDataset: any;

beforeAll(async () => {
  const shapesText = readFileSync(SHAPES_PATH, 'utf8');
  const shapes = await parseTurtle(shapesText, `file://${SHAPES_PATH}`);
  validator = new ShaclValidatorCtor(shapes, { factory: FACTORY });

  const vocabTtl = writeTurtle(emitVocabularyGraph());
  vocabDataset = await parseTurtle(vocabTtl, 'https://glossarist.org/vocab');
});

interface Violation {
  readonly shape: string;
  readonly path: string;
  readonly focus: string;
  readonly message: string;
}

function violationsFor(report: any): Violation[] {
  if (report.conforms) return [];
  return report.results.map((r: any) => ({
    shape:   r.shape?.value   ?? '(unknown)',
    path:    r.path?.value    ?? '(unknown)',
    focus:   r.focusNode?.value ?? '(unknown)',
    message: r.message?.length ? r.message.map((m: any) => m.value).join('; ') : '',
  }));
}

function uniquePaths(violations: readonly Violation[]): readonly string[] {
  return [...new Set(violations.map(v => v.path))].sort();
}

describe('Layer 4 — SHACL conformance for every emitted fixture', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    it(`${fixture.name}: emitted Turtle + vocab conforms to glossarist SHACL shapes`, async () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
      const ttl = writeTurtle(graph);
      const data = await parseTurtle(ttl, fixture.uri);

      const combined = FACTORY.dataset();
      for (const q of (vocabDataset as any)) combined.add(q);
      for (const q of (data as any)) combined.add(q);

      const report = validator.validate(combined);
      const violations = violationsFor(report);

      if (!report.conforms) {
        const detail = violations.map(v => `  path=${v.path}\n  focus=${v.focus}`).join('\n');
        expect.fail(`SHACL violations for ${fixture.name}:\n${detail}`);
      }
      expect(report.conforms).toBe(true);
    });
  }

  it('vocabulary graph is a valid skos:ConceptScheme set', async () => {
    const vocabTtl = writeTurtle(emitVocabularyGraph());
    const ds = await parseTurtle(vocabTtl, 'https://glossarist.org/vocab');
    const SKOS = 'http://www.w3.org/2004/02/skos/core#';
    const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    const concepts = [...(ds as any)].filter((q: any) =>
      q.predicate.value === RDF_TYPE && q.object.value === `${SKOS}Concept`,
    );
    const schemes = [...(ds as any)].filter((q: any) =>
      q.predicate.value === RDF_TYPE && q.object.value === `${SKOS}ConceptScheme`,
    );
    expect(schemes.length).toBeGreaterThan(0);
    expect(concepts.length).toBeGreaterThan(0);
  });
});
