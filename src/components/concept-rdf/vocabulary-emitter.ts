import { GLOSS, SKOS, RDF, RDFS } from './predicates';
import { RdfGraph, lit, iri, triple } from './rdf-graph';

export interface VocabTerm {
  readonly iri: string;
  readonly label: string;
}

export interface VocabScheme {
  readonly schemeIri: string;
  readonly label: string;
  readonly terms: readonly VocabTerm[];
}

const STATUS_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:status/valid',       label: 'valid' },
  { iri: 'gloss:status/superseded',  label: 'superseded' },
  { iri: 'gloss:status/withdrawn',   label: 'withdrawn' },
  { iri: 'gloss:status/draft',       label: 'draft' },
];

const ENTRY_STATUS_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:entstatus/valid',        label: 'valid' },
  { iri: 'gloss:entstatus/superseded',   label: 'superseded' },
  { iri: 'gloss:entstatus/withdrawn',    label: 'withdrawn' },
  { iri: 'gloss:entstatus/draft',        label: 'draft' },
];

const NORM_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:norm/preferred',  label: 'preferred' },
  { iri: 'gloss:norm/admitted',   label: 'admitted' },
  { iri: 'gloss:norm/deprecated', label: 'deprecated' },
];

const SRC_STATUS_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:srcstatus/identical',  label: 'identical' },
  { iri: 'gloss:srcstatus/restyled',   label: 'restyled' },
  { iri: 'gloss:srcstatus/modified',   label: 'modified' },
  { iri: 'gloss:srcstatus/adapted',    label: 'adapted' },
];

const SRC_TYPE_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:srctype/authoritative', label: 'authoritative' },
  { iri: 'gloss:srctype/lineage',       label: 'lineage' },
];

const DATE_TYPE_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:datetype/accepted', label: 'accepted' },
  { iri: 'gloss:datetype/amended',  label: 'amended' },
  { iri: 'gloss:datetype/retired',  label: 'retired' },
];

const REL_TYPE_TERMS: readonly VocabTerm[] = [
  { iri: 'gloss:rel/supersedes',     label: 'supersedes' },
  { iri: 'gloss:rel/superseded_by',  label: 'superseded_by' },
  { iri: 'gloss:rel/derived',        label: 'derived' },
  { iri: 'gloss:rel/compare',        label: 'compare' },
  { iri: 'gloss:rel/contrast',       label: 'contrast' },
  { iri: 'gloss:rel/see',            label: 'see' },
];

export const VOCAB_SCHEMES: readonly VocabScheme[] = [
  { schemeIri: 'gloss:status-scheme',    label: 'Concept status',    terms: STATUS_TERMS },
  { schemeIri: 'gloss:entstatus-scheme', label: 'Entry status',      terms: ENTRY_STATUS_TERMS },
  { schemeIri: 'gloss:norm-scheme',      label: 'Normative status',  terms: NORM_TERMS },
  { schemeIri: 'gloss:srcstatus-scheme', label: 'Source status',     terms: SRC_STATUS_TERMS },
  { schemeIri: 'gloss:srctype-scheme',   label: 'Source type',       terms: SRC_TYPE_TERMS },
  { schemeIri: 'gloss:datetype-scheme',  label: 'Date type',         terms: DATE_TYPE_TERMS },
  { schemeIri: 'gloss:rel-scheme',       label: 'Relationship type', terms: REL_TYPE_TERMS },
];

export function emitVocabularyGraph(): RdfGraph {
  const graph = new RdfGraph();
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
