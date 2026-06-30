import { GLOSS, SKOS, DCTERMS, DCAT, RDF, RDFS, XSD, PROV } from './predicates';
import { RdfGraph, lit, iri, blank, triple } from './rdf-graph';

export interface DatasetEmitterInput {
  readonly datasetIri: string;
  readonly registerId: string;
  readonly title: string;
  readonly description?: string;
  readonly modified: string;
  readonly languages: readonly string[];
  readonly distributions: readonly DatasetDistribution[];
  readonly topConceptUris: readonly string[];
  readonly sections: readonly DatasetSection[];
  readonly sourceRepoUrl?: string;
  readonly publisherIri?: string;
  readonly contactIri?: string;
}

export interface DatasetDistribution {
  readonly id: string;
  readonly title: string;
  readonly mediaType: string;
  readonly downloadUrl: string;
  readonly byteSize?: number;
}

export interface DatasetSection {
  readonly collectionIri: string;
  readonly title: string;
  readonly memberUris: readonly string[];
}

export function emitDatasetGraph(input: DatasetEmitterInput): RdfGraph {
  const graph = new RdfGraph();
  const w = graph.declare(input.datasetIri, {
    types: [DCAT.Dataset, SKOS.ConceptScheme],
    label: input.title,
    classLabel: 'Dataset',
    classId: DCAT.Dataset,
  });

  w.literal(DCTERMS.title, input.title);
  if (input.description) w.literal(DCTERMS.description, input.description);
  w.literal(DCTERMS.modified, input.modified, { datatype: XSD.date });
  w.literal(DCTERMS.identifier, input.registerId);

  for (const lang of input.languages) {
    const langIri = `http://id.loc.gov/vocabulary/iso639-1/${lang}`;
    w.iri(DCTERMS.language, langIri);
  }

  for (const dist of input.distributions) {
    const distTriples = [
      triple(RDF.type, iri(DCAT.Distribution)),
      triple(DCTERMS.title, lit(dist.title)),
      triple(DCAT.mediaType, lit(dist.mediaType)),
      triple(DCAT.downloadURL, iri(dist.downloadUrl)),
    ];
    if (dist.byteSize != null) {
      distTriples.push(triple(DCAT.byteSize, lit(String(dist.byteSize), { datatype: XSD.integer })));
    }
    w.blank(DCAT.distribution, distTriples);
  }

  for (const concept of input.topConceptUris) {
    w.iri(SKOS.hasTopConcept, concept);
  }

  if (input.sourceRepoUrl) w.iri(PROV.wasDerivedFrom, input.sourceRepoUrl);
  if (input.publisherIri) w.iri(DCTERMS.publisher, input.publisherIri);
  if (input.contactIri) w.iri(DCAT.contactPoint, input.contactIri);

  for (const section of input.sections) {
    const collectionW = graph.declare(section.collectionIri, {
      types: [SKOS.Collection],
      label: section.title,
      classLabel: 'Collection',
      classId: SKOS.Collection,
    });
    collectionW.literal(DCTERMS.title, section.title);
    for (const member of section.memberUris) {
      collectionW.iri(SKOS.member, member);
    }
  }

  return graph;
}
