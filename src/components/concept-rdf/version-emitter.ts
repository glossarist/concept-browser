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

    for (const r of single.resources()) {
      const w = graph.declare(r.subject, {
        types: [...r.types],
        label: r.label,
        classLabel: r.classLabel,
        classId: r.classId,
      });
      for (const t of r.triples) {
        if (t.object.kind === 'iri') {
          w.iri(t.predicate, t.object.value);
        } else if (t.object.kind === 'literal') {
          w.literal(t.predicate, t.object.value, {
            lang: t.object.lang,
            datatype: t.object.datatype,
          });
        }
      }
    }

    previousIri = versionIri;
  }
  return graph;
}