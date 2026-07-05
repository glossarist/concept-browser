import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Parser, Store } from 'n3';

function parseTurtle(text: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(text));
  return store;
}

function runInline(code: string): string {
  return execFileSync('node', ['--input-type=module', '-e', code], { encoding: 'utf8' }).toString();
}

describe('WS F Layer 8 — build pipeline integration', () => {
  it('vocab-turtle.mjs produces parseable Turtle with 7 schemes', () => {
    const out = runInline(`import { buildVocabularyTurtle } from './scripts/lib/vocab-turtle.mjs'; console.log(await buildVocabularyTurtle());`);
    const store = parseTurtle(out);
    const schemes = [...store].filter(q =>
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      q.object.value === 'http://www.w3.org/2004/02/skos/core#ConceptScheme',
    );
    expect(schemes.length).toBe(7);
  });

  it('dataset-turtle.mjs produces parseable dcat:Dataset', () => {
    const out = runInline(`
      import { buildDatasetTurtle } from './scripts/lib/dataset-turtle.mjs';
      console.log(await buildDatasetTurtle({
        datasetIri: 'https://glossarist.org/test/',
        registerId: 'test', title: 'Test', modified: '2026-06-28',
        languages: ['eng'], distributions: [], topConceptUris: [], sections: [],
      }));
    `);
    const store = parseTurtle(out);
    const types = [...store].filter(q =>
      q.subject.value === 'https://glossarist.org/test/' &&
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    ).map(q => q.object.value);
    expect(types).toContain('http://www.w3.org/ns/dcat#Dataset');
    expect(types).toContain('http://www.w3.org/2004/02/skos/core#ConceptScheme');
  });

  it('build-activity-turtle.mjs produces parseable prov:Activity', () => {
    const out = runInline(`
      import { buildActivityTurtle } from './scripts/lib/build-activity-turtle.mjs';
      console.log(await buildActivityTurtle({
        runId: 'test', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:05:00Z',
        toolId: 'cb', toolVersion: '0.7.52', datasetRegisters: [], conceptCount: 0,
      }));
    `);
    const store = parseTurtle(out);
    const activities = [...store].filter(q =>
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      q.object.value === 'http://www.w3.org/ns/prov#Activity',
    );
    expect(activities.length).toBe(1);
  });

  it('agents-turtle.mjs produces parseable foaf:Person', () => {
    const out = runInline(`
      import { buildAgentsTurtle } from './scripts/lib/agents-turtle.mjs';
      console.log(await buildAgentsTurtle([{ name: 'Ada Lovelace', role: 'Editor', organization: 'Royal Society' }]));
    `);
    const store = parseTurtle(out);
    const persons = [...store].filter(q =>
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      q.object.value === 'http://xmlns.com/foaf/0.1/Person',
    );
    expect(persons.length).toBe(1);
  });

  it('bibliography-turtle.mjs produces parseable dcterms:BibliographicResource', () => {
    const out = runInline(`
      import { buildBibliographyTurtle } from './scripts/lib/bibliography-turtle.mjs';
      console.log(await buildBibliographyTurtle('test', { iso704: { reference: 'ISO 704' } }));
    `);
    const store = parseTurtle(out);
    const bibs = [...store].filter(q =>
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      q.object.value === 'http://purl.org/dc/terms/BibliographicResource',
    );
    expect(bibs.length).toBe(1);
  });

  it('version-turtle.mjs produces parseable prov:Entity chain', () => {
    const out = runInline(`
      import { buildVersionHistoryTurtle } from './scripts/lib/version-turtle.mjs';
      console.log(await buildVersionHistoryTurtle({
        registerId: 'test', datasetIri: 'https://glossarist.org/test/',
        versions: [
          { version: '1.0', generatedAt: '2024-01-01T00:00:00Z' },
          { version: '1.1', generatedAt: '2024-06-01T00:00:00Z' },
        ],
      }));
    `);
    const store = parseTurtle(out);
    const versions = [...store].filter(q =>
      q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      q.object.value === 'http://www.w3.org/ns/prov#Entity',
    );
    expect(versions.length).toBe(2);

    const wasRevision = store.getObjects(
      'https://glossarist.org/test/versions/1.1',
      'http://www.w3.org/ns/prov#wasRevisionOf',
      null,
    ).map(q => q.value);
    expect(wasRevision).toContain('https://glossarist.org/test/versions/1.0');
  });

  it('all six emitters produce parseable output in a single subprocess', () => {
    const out = runInline(`
      import { buildVocabularyTurtle } from './scripts/lib/vocab-turtle.mjs';
      import { buildDatasetTurtle } from './scripts/lib/dataset-turtle.mjs';
      import { buildActivityTurtle } from './scripts/lib/build-activity-turtle.mjs';
      import { buildAgentsTurtle } from './scripts/lib/agents-turtle.mjs';
      import { buildBibliographyTurtle } from './scripts/lib/bibliography-turtle.mjs';
      import { buildVersionHistoryTurtle } from './scripts/lib/version-turtle.mjs';
      const parts = [
        await buildVocabularyTurtle(),
        await buildDatasetTurtle({ datasetIri: 'https://glossarist.org/test/', registerId: 'test', title: 't', modified: '2026-01-01', languages: ['eng'], distributions: [], topConceptUris: [], sections: [] }),
        await buildActivityTurtle({ runId: 'r', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:05:00Z', toolId: 'cb', toolVersion: '0', datasetRegisters: [], conceptCount: 0 }),
        await buildAgentsTurtle([{ name: 'Ada' }]),
        await buildBibliographyTurtle('test', { x: { reference: 'X' } }),
        await buildVersionHistoryTurtle({ registerId: 't', datasetIri: 'https://glossarist.org/t/', versions: [{ version: '1', generatedAt: '2026-01-01' }] }),
      ];
      console.log(parts.join('\\n'));
    `);
    const store = parseTurtle(out);
    expect(store.size).toBeGreaterThan(100);
  });
});