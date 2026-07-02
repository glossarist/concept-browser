import { describe, it, expect, beforeAll } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { CONCEPT_FIXTURES } from '../__fixtures__/concepts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const SNAPSHOTS_DIR = join(ROOT, 'test', 'snapshots', 'js');

beforeAll(() => {
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });
});

describe('WS P1 — JS snapshot generator', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    it(`emits a canonical Turtle snapshot for ${fixture.name}`, () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
      const ttl = writeTurtle(graph);
      const target = join(SNAPSHOTS_DIR, `${fixture.name}.ttl`);
      writeFileSync(target, ttl);
      expect(existsSync(target)).toBe(true);
      expect(ttl.length).toBeGreaterThan(0);
    });
  }

  it('snapshot directory contains one .ttl per fixture after generation', () => {
    const files = existsSync(SNAPSHOTS_DIR)
      ? readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.ttl'))
      : [];
    expect(files.length).toBeGreaterThanOrEqual(CONCEPT_FIXTURES.length);
    for (const fixture of CONCEPT_FIXTURES) {
      expect(files).toContain(`${fixture.name}.ttl`);
    }
  });

  it('re-emitting the same fixture produces byte-identical Turtle (deterministic)', () => {
    for (const fixture of CONCEPT_FIXTURES) {
      const a = writeTurtle(emitConceptGraph(fixture.concept, fixture.uri).graph);
      const b = writeTurtle(emitConceptGraph(fixture.concept, fixture.uri).graph);
      expect(a).toBe(b);
    }
  });
});

describe('WS P1 — JS snapshots are stable across runs (drift detector)', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    it(`${fixture.name}: emitted snapshot matches the file on disk (run npm test to refresh)`, () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
      const ttl = writeTurtle(graph);
      const target = join(SNAPSHOTS_DIR, `${fixture.name}.ttl`);
      if (!existsSync(target)) {
        writeFileSync(target, ttl);
        return;
      }
      const existing = readFileSync(target, 'utf8');
      if (existing !== ttl) {
        writeFileSync(target, ttl);
        expect.fail(
          `Snapshot drift for ${fixture.name}.\n` +
          `Updated ${target}.\n` +
          `Commit the change if the new output is the canonical shape.`,
        );
      }
      expect(existing).toBe(ttl);
    });
  }
});

function readdirSync(p: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:fs').readdirSync(p);
}
