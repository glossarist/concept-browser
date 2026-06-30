import { DCTERMS, FOAF, RDFS, RDF } from './predicates';
import { RdfGraph } from './rdf-graph';

export interface BibliographyEntry {
  readonly id: string;
  readonly reference: string;
  readonly title?: string;
  readonly link?: string;
}

export interface BibliographyInput {
  readonly registerId: string;
  readonly entries: readonly BibliographyEntry[];
  readonly baseUri?: string;
}

export function bibliographyEntryIri(registerId: string, id: string, baseUri = 'https://glossarist.org'): string {
  return `${baseUri}/${registerId}/bib/${id}`;
}

export function emitBibliographyGraph(input: BibliographyInput): RdfGraph {
  const baseUri = input.baseUri ?? 'https://glossarist.org';
  const graph = new RdfGraph();
  for (const entry of input.entries) {
    const iri = bibliographyEntryIri(input.registerId, entry.id, baseUri);
    const w = graph.declare(iri, {
      types: ['dcterms:BibliographicResource'],
      label: entry.title ?? entry.reference,
      classLabel: 'BibliographicResource',
      classId: 'dcterms:BibliographicResource',
    });
    w.literal(DCTERMS.identifier, entry.id);
    w.literal(DCTERMS.bibliographicCitation, entry.reference);
    if (entry.title) w.literal(DCTERMS.title, entry.title);
    if (entry.link) w.iri(FOAF.page, entry.link);
    w.iri(DCTERMS.isPartOf, `${baseUri}/${input.registerId}/`);
  }
  return graph;
}