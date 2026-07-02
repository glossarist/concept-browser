import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKOS } from './predicates';
import { RdfGraph } from './rdf-graph';
import type { RdfGraph as RdfGraphType } from './rdf-graph';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOCAB_PATH = join(__dirname, '..', '..', '..', 'data', 'glossarist-vocab.json');

export interface VocabTerm {
  readonly iri: string;
  readonly label: string;
  readonly group?: string;
}

export interface VocabScheme {
  readonly schemeIri: string;
  readonly label: string;
  readonly terms: readonly VocabTerm[];
}

interface VocabFile {
  readonly schemes: readonly VocabScheme[];
}

let cached: VocabFile | undefined;

export function loadVocabulary(path: string = VOCAB_PATH): VocabFile {
  if (cached && path === VOCAB_PATH) return cached;
  const text = readFileSync(path, 'utf8');
  cached = JSON.parse(text) as VocabFile;
  return cached;
}

export const VOCAB_SCHEMES: readonly VocabScheme[] = loadVocabulary().schemes;

export function emitVocabularyGraph(graph: RdfGraphType = new RdfGraph()): RdfGraphType {
  for (const scheme of VOCAB_SCHEMES) {
    const schemeW = graph.declare(scheme.schemeIri, {
      types: [SKOS.ConceptScheme],
      label: scheme.label,
      classLabel: 'ConceptScheme',
      classId: SKOS.ConceptScheme,
    });
    for (const term of scheme.terms) {
      const termW = graph.declare(term.iri, {
        types: [SKOS.Concept],
        label: term.label,
        classLabel: 'Concept',
        classId: SKOS.Concept,
      });
      termW.iri(SKOS.inScheme, scheme.schemeIri);
      schemeW.iri(SKOS.hasTopConcept, term.iri);
    }
  }
  return graph;
}

export function listVocabSchemes(): readonly VocabScheme[] {
  return VOCAB_SCHEMES;
}
