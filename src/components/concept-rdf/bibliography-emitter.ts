import { DCTERMS, FOAF, RDF } from './predicates';
import { RdfGraph } from './rdf-graph';

export interface BibliographyEntry {
  readonly id: string;
  readonly reference: string;
  readonly title?: string;
  readonly link?: string;
  readonly type?: string;
}

export interface BibliographyInput {
  readonly registerId: string;
  readonly entries: readonly BibliographyEntry[];
  readonly baseUri?: string;
}

type BibliographyDataShape =
  | { [id: string]: BibliographyEntryLike }
  | { bibliography: readonly BibliographyEntryLike[] };

interface BibliographyEntryLike {
  readonly id?: string;
  readonly reference?: string;
  readonly title?: string;
  readonly link?: string;
  readonly type?: string;
}

export function bibliographyEntryIri(registerId: string, id: string, baseUri = 'https://glossarist.org'): string {
  return `${baseUri}/${registerId}/bib/${id}`;
}

export function normalizeBibliographyData(raw: unknown): readonly BibliographyEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.bibliography)) {
    return (obj.bibliography as readonly BibliographyEntryLike[]).map(e => entryFromV3(e));
  }

  const entries: BibliographyEntry[] = [];
  for (const [id, value] of Object.entries(obj)) {
    if (!value || typeof value !== 'object') continue;
    const entry = entryFromV3(value as BibliographyEntryLike, id);
    entries.push(entry);
  }
  return entries;
}

function entryFromV3(e: BibliographyEntryLike, fallbackId?: string): BibliographyEntry {
  const id = e.id ?? fallbackId ?? '';
  const reference = e.reference ?? '';
  return {
    id,
    reference,
    title: e.title,
    link: e.link,
    type: e.type,
  };
}

export function emitBibliographyGraph(input: BibliographyInput): RdfGraph {
  const baseUri = input.baseUri ?? 'https://glossarist.org';
  const graph = new RdfGraph();
  for (const entry of input.entries) {
    if (!entry.id || !entry.reference) continue;
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
    if (entry.type) w.iri(DCTERMS.type, `gloss:bibtype/${entry.type}`);
    w.iri(DCTERMS.isPartOf, `${baseUri}/${input.registerId}/`);
  }
  return graph;
}