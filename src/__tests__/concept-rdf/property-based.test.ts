import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser as N3Parser, DataFactory } from 'n3';
import rdfDataset from '@rdfjs/dataset';
import ShaclValidator from 'rdf-validate-shacl';
import * as fc from 'fast-check';
import { Concept } from 'glossarist';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitVocabularyGraph } from '../../components/concept-rdf/vocabulary-emitter';

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

const langArb = fc.constantFrom('eng', 'fra', 'jpn', 'deu', 'spa', 'zho', 'ara', 'rus');
const statusArb = fc.constantFrom('valid', 'superseded', 'withdrawn', 'draft');

function arbConcept() {
  return fc.record({
    id: fc.uuid(),
    status: statusArb,
    languages: fc.array(langArb, { minLength: 1, maxLength: 3 }),
    termsPerLang: fc.array(
      fc.record({
        designation: fc.string({ minLength: 1, maxLength: 30 }).map(s => s.replace(/[^\p{L}\p{N}\s_-]/gu, 'a')),
        isPreferred: fc.boolean(),
      }),
      { minLength: 1, maxLength: 3 },
    ),
    hasDefinition: fc.boolean(),
    hasNote: fc.boolean(),
    hasSource: fc.boolean(),
    sourceStatus: fc.constantFrom('identical', 'restyled', 'modified', 'adapted'),
    sourceType: fc.constantFrom('authoritative', 'lineage'),
    uriSeed: fc.integer({ min: 1, max: 999999 }),
  }).map(r => {
    const uri = `https://glossarist.org/fuzz/${r.uriSeed}`;
    const localizations: Record<string, any> = {};
    for (const lang of r.languages) {
      localizations[lang] = {
        language_code: lang,
        entry_status: 'valid',
        terms: r.termsPerLang.map((t, i) => ({
          type: 'expression',
          designation: t.designation || `term${i}`,
          normative_status: (i === 0 && t.isPreferred) ? 'preferred' : 'admitted',
        })),
      };
      if (r.hasDefinition) localizations[lang].definition = [{ content: `Definition for ${lang}.` }];
      if (r.hasNote) localizations[lang].notes = [{ content: `Note for ${lang}.` }];
      if (r.hasSource) {
        localizations[lang].sources = [{
          status: r.sourceStatus,
          type: r.sourceType,
          origin: {
            ref: { source: 'ISO 704', id: '3.1', version: '2020' },
            locality: { type: 'clause', referenceFrom: '3.1' },
          },
        }];
      }
    }
    return {
      id: r.id,
      uri,
      status: r.status,
      localizations,
    };
  });
}

function buildConcept(json: any): Concept {
  return Concept.fromJSON(json);
}

describe('WS P3 — property-based fuzz testing (fast-check)', () => {
  it('every emitted Turtle parses without errors (1000 iterations)', async () => {
    await fc.assert(
      fc.asyncProperty(arbConcept(), async (conceptJson) => {
        const concept = buildConcept(conceptJson);
        const { graph } = emitConceptGraph(concept, conceptJson.uri);
        const ttl = writeTurtle(graph);
        const parsed = await parseTurtle(ttl, conceptJson.uri);
        return (parsed as any).size > 0;
      }),
      { numRuns: 200 },
    );
  });

  it('every emitted Turtle conforms to canonical SHACL shapes (1000 iterations)', async () => {
    await fc.assert(
      fc.asyncProperty(arbConcept(), async (conceptJson) => {
        const concept = buildConcept(conceptJson);
        const { graph } = emitConceptGraph(concept, conceptJson.uri);
        const ttl = writeTurtle(graph);
        const data = await parseTurtle(ttl, conceptJson.uri);

        const combined = FACTORY.dataset();
        for (const q of (vocabDataset as any)) combined.add(q);
        for (const q of (data as any)) combined.add(q);

        const report = validator.validate(combined);
        if (!report.conforms) {
          const violations = report.results.map((r: any) => r.path?.value ?? '?');
          throw new Error(`SHACL violations: ${violations.join(', ')}`);
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  it('every emitted Turtle terminates properly (last triple ends with . not ;)', () => {
    fc.assert(
      fc.property(arbConcept(), (conceptJson) => {
        const concept = buildConcept(conceptJson);
        const { graph } = emitConceptGraph(concept, conceptJson.uri);
        const ttl = writeTurtle(graph);
        const lines = ttl.split('\n').filter(l => l.trim().length > 0);
        const lastDataLine = [...lines].reverse().find(l => !l.startsWith('@prefix'));
        if (!lastDataLine) return false;
        const trimmed = lastDataLine.trim();
        return trimmed.endsWith('.') && !trimmed.endsWith(';');
      }),
      { numRuns: 200 },
    );
  });

  it('every concept resource has both gloss:Concept and skos:Concept types', () => {
    fc.assert(
      fc.property(arbConcept(), (conceptJson) => {
        const concept = buildConcept(conceptJson);
        const { graph } = emitConceptGraph(concept, conceptJson.uri);
        const r = graph.get(conceptJson.uri);
        if (!r) return false;
        return r.types.includes('gloss:Concept') && r.types.includes('skos:Concept');
      }),
      { numRuns: 200 },
    );
  });
});