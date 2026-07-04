import { DCAT, DCTERMS, RDF, SKOS, XSD, PROV } from './predicates';
import { RdfGraph, lit, iri, blank, triple } from './rdf-graph';
import type { RdfTriple } from './rdf-graph';
import type { DatasetGroupKind } from '../../config/types';

export interface GroupEmitInput {
  readonly groupId: string;
  readonly groupIri: string;
  readonly kind: DatasetGroupKind;
  readonly title: string;
  readonly description?: string;
  readonly memberIris: readonly string[];
  readonly currentMemberIri?: string;
  readonly baseUri?: string;
  readonly subject?: string;
  readonly themes?: readonly string[];
  readonly keywords?: readonly string[];
  readonly publisher?: string;
  readonly contact?: string;
  readonly sourceRepo?: string;
}

function rdfClassForKind(kind: DatasetGroupKind): string[] {
  switch (kind) {
    case 'lineage': return [DCAT.DatasetSeries, SKOS.ConceptScheme];
    case 'topic':
    case 'family':
    case 'collection': return [DCAT.Catalog, SKOS.ConceptScheme];
    default: return [];
  }
}

export function emitGroupGraph(input: GroupEmitInput): RdfGraph {
  const graph = new RdfGraph();
  const classes = rdfClassForKind(input.kind);
  if (classes.length === 0) return graph;

  const w = graph.declare(input.groupIri, {
    types: classes,
    label: input.title,
    classLabel: 'Group',
    classId: classes[0],
  });

  w.literal(DCTERMS.title, input.title);
  w.literal(DCTERMS.identifier, input.groupId);
  if (input.description) w.literal(DCTERMS.description, input.description);
  if (input.subject) w.literal(DCTERMS.subject, input.subject);
  for (const theme of input.themes ?? []) w.iri(DCAT.theme, theme);
  for (const kw of input.keywords ?? []) w.literal(DCAT.keyword, kw);
  if (input.publisher) w.iri(DCTERMS.publisher, input.publisher);
  if (input.contact) w.iri(DCAT.contactPoint, input.contact);
  if (input.sourceRepo) w.iri(PROV.wasDerivedFrom, input.sourceRepo);

  if (input.kind === 'lineage') {
    for (const memberIri of input.memberIris) {
      w.iri(DCAT.hasVersion, memberIri);
    }
    if (input.currentMemberIri) {
      w.iri(DCAT.hasCurrentVersion, input.currentMemberIri);
    }
  } else {
    for (const memberIri of input.memberIris) {
      w.iri(DCAT.dataset, memberIri);
    }
  }

  return graph;
}