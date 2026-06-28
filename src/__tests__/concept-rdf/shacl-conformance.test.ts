import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser as N3Parser, DataFactory } from 'n3';
import rdfDataset from '@rdfjs/dataset';
import ShaclValidator from 'rdf-validate-shacl';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
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

beforeAll(async () => {
  const shapesText = readFileSync(SHAPES_PATH, 'utf8');
  const shapes = await parseTurtle(shapesText, `file://${SHAPES_PATH}`);
  validator = new ShaclValidatorCtor(shapes, { factory: FACTORY });
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

describe('Layer 4 — SHACL conformance probe (records current state)', () => {
  const summary: Record<string, readonly string[]> = {};

  for (const fixture of CONCEPT_FIXTURES) {
    it(`${fixture.name}: validates against glossarist.shacl.ttl and records violations`, async () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
      const ttl = writeTurtle(graph);
      const data = await parseTurtle(ttl, fixture.uri);
      const report = validator.validate(data);
      const violations = violationsFor(report);
      summary[fixture.name] = uniquePaths(violations);

      // The probe's invariant: validation runs cleanly and produces a structured result.
      // Whether each fixture conforms is recorded in `summary` for the doc below.
      expect(typeof report.conforms).toBe('boolean');
    });
  }

  it('emits a human-readable divergence report at suite end', () => {
    const lines: string[] = [];
    lines.push('SHACL conformance summary (Layer 4 probe):');
    for (const [name, paths] of Object.entries(summary)) {
      if (paths.length === 0) {
        lines.push(`  ${name}: conforms`);
      } else {
        lines.push(`  ${name}: ${paths.length} violating path(s)`);
        for (const p of paths) lines.push(`    - ${p}`);
      }
    }
    // Print to stdout for visibility, not as an assertion failure.
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(Object.keys(summary).length).toBe(CONCEPT_FIXTURES.length);
  });
});
