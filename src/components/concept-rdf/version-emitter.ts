import { PROV, DCTERMS, XSD } from './predicates';
import { RdfGraph, lit, iri, triple } from './rdf-graph';

export interface DatasetVersionInput {
  readonly registerId: string;
  readonly version: string;
  readonly versionIri: string;
  readonly datasetIri: string;
  readonly generatedAt: string;
  readonly previousVersionIri?: string;
  readonly changeSummary?: string;
  readonly associatedAgentIri?: string;
}

export function emitVersionGraph(input: DatasetVersionInput): RdfGraph {
  const graph = new RdfGraph();
  const w = graph.declare(input.versionIri, {
    types: [PROV.Entity],
    label: `${input.registerId} version ${input.version}`,
    classLabel: 'Version',
    classId: PROV.Entity,
  });
  w.literal(DCTERMS.isVersionOf, input.datasetIri);
  if (input.previousVersionIri) {
    w.iri(PROV.wasRevisionOf, input.previousVersionIri);
  }
  w.literal(PROV.generatedAtTime, input.generatedAt, { datatype: XSD.dateTime });
  if (input.changeSummary) w.literal(DCTERMS.description, input.changeSummary);
  if (input.associatedAgentIri) w.iri(PROV.wasAssociatedWith, input.associatedAgentIri);
  return graph;
}

export interface VersionHistoryEntry {
  readonly version: string;
  readonly generatedAt: string;
  readonly changeSummary?: string;
}

export interface VersionEmitAllInput {
  readonly registerId: string;
  readonly datasetIri: string;
  readonly versions: readonly VersionHistoryEntry[];
  readonly associatedAgentIri?: string;
}

export function emitVersionHistory(input: VersionEmitAllInput): RdfGraph {
  const graph = new RdfGraph();
  let previousIri: string | undefined;
  for (const v of input.versions) {
    const versionIri = `${input.datasetIri}versions/${v.version}`;
    const single = emitVersionGraph({
      registerId: input.registerId,
      version: v.version,
      versionIri,
      datasetIri: input.datasetIri,
      generatedAt: v.generatedAt,
      previousVersionIri: previousIri,
      changeSummary: v.changeSummary,
      associatedAgentIri: input.associatedAgentIri,
    });
    graph.merge(single);
    previousIri = versionIri;
  }
  return graph;
}