import { GLOSS, DCTERMS, XSD, PROV, FOAF } from './predicates';
import { RdfGraph, lit, iri, blank, triple } from './rdf-graph';

export interface BuildActivityInput {
  readonly runId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly gitSha?: string;
  readonly gitBranch?: string;
  readonly toolId: string;
  readonly toolVersion: string;
  readonly datasetRegisters: readonly string[];
  readonly conceptCount: number;
  readonly associatedAgentIri?: string;
}

export function activityIri(input: BuildActivityInput): string {
  return `activity/build/${input.runId}`;
}

export function emitBuildActivityGraph(input: BuildActivityInput): RdfGraph {
  const graph = new RdfGraph();
  const iriStr = activityIri(input);
  const w = graph.declare(iriStr, {
    types: [PROV.Activity],
    label: `build ${input.runId}`,
    classLabel: 'Activity',
    classId: PROV.Activity,
  });

  w.literal(PROV.generatedAtTime, input.endedAt, { datatype: XSD.dateTime });

  const startW = graph.declare(`${iriStr}/start`, {
    types: ['prov:StartingPoint'],
    label: `start ${input.runId}`,
    classLabel: 'StartingPoint',
    classId: 'prov:StartingPoint',
  });
  startW.literal('prov:atTime', input.startedAt, { datatype: XSD.dateTime });

  const endW = graph.declare(`${iriStr}/end`, {
    types: ['prov:EndingPoint'],
    label: `end ${input.runId}`,
    classLabel: 'EndingPoint',
    classId: 'prov:EndingPoint',
  });
  endW.literal('prov:atTime', input.endedAt, { datatype: XSD.dateTime });

  if (input.gitSha) {
    const commitIri = `https://glossarist.org/commit/${input.gitSha}`;
    w.iri(PROV.used, commitIri);
    const commitW = graph.declare(commitIri, {
      types: [PROV.Entity],
      label: input.gitSha,
      classLabel: 'Entity',
      classId: PROV.Entity,
    });
    if (input.gitBranch) commitW.literal(DCTERMS.description, `branch: ${input.gitBranch}`);
  }

  const toolIri = `https://glossarist.org/tool/${input.toolId}/${input.toolVersion}`;
  w.iri(PROV.used, toolIri);
  const toolW = graph.declare(toolIri, {
    types: [PROV.Entity],
    label: `${input.toolId} ${input.toolVersion}`,
    classLabel: 'Entity',
    classId: PROV.Entity,
  });
  toolW.literal(DCTERMS.identifier, input.toolVersion);

  for (const register of input.datasetRegisters) {
    w.iri(PROV.used, `https://glossarist.org/${register}/`);
  }

  w.literal('gloss:conceptCount', String(input.conceptCount), { datatype: XSD.integer });

  if (input.associatedAgentIri) {
    w.iri(PROV.wasAssociatedWith, input.associatedAgentIri);
    graph.declare(input.associatedAgentIri, {
      types: [PROV.Agent, FOAF.Person],
      label: input.associatedAgentIri.split('/').pop() ?? 'agent',
      classLabel: 'Agent',
      classId: PROV.Agent,
    });
  }

  return graph;
}
