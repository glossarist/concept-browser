import { FOAF, PROV, DCTERMS, RDFS } from './predicates';
import { RdfGraph } from './rdf-graph';

export interface AgentInput {
  readonly slug: string;
  readonly name: string;
  readonly role?: string;
  readonly organization?: string;
  readonly url?: string;
  readonly email?: string;
  readonly agentIri: string;
}

export interface AgentEmissionResult {
  readonly graph: RdfGraph;
  readonly personIris: readonly string[];
  readonly organizationIris: readonly string[];
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function agentsFromContributors(
  contributors: readonly { name: string; role?: string; organization?: string; url?: string; email?: string }[],
  agentBase = 'https://glossarist.org/agent',
): readonly AgentInput[] {
  return contributors.map(c => ({
    slug: slugify(c.name),
    name: c.name,
    role: c.role,
    organization: c.organization,
    url: c.url,
    email: c.email,
    agentIri: `${agentBase}/${slugify(c.name)}`,
  }));
}

export function emitAgentsGraph(agents: readonly AgentInput[]): AgentEmissionResult {
  const graph = new RdfGraph();
  const personIris: string[] = [];
  const orgSlugs = new Set<string>();
  const organizationIris: string[] = [];

  for (const a of agents) {
    const w = graph.declare(a.agentIri, {
      types: [FOAF.Person, PROV.Person, PROV.Agent],
      label: a.name,
      classLabel: 'Person',
      classId: FOAF.Person,
    });
    w.literal(FOAF.name, a.name);
    if (a.email) w.iri(FOAF.mbox, `mailto:${a.email}`);
    if (a.url) w.iri(RDFS.seeAlso, a.url);
    if (a.role) w.literal(DCTERMS.description, a.role);
    personIris.push(a.agentIri);

    if (a.organization) {
      const orgSlug = slugify(a.organization);
      const orgIri = `https://glossarist.org/org/${orgSlug}`;
      w.iri(PROV.actedOnBehalfOf, orgIri);
      if (!orgSlugs.has(orgSlug)) {
        orgSlugs.add(orgSlug);
        const orgW = graph.declare(orgIri, {
          types: [FOAF.Organization, PROV.Organization, PROV.Agent],
          label: a.organization,
          classLabel: 'Organization',
          classId: FOAF.Organization,
        });
        orgW.literal(FOAF.name, a.organization);
        organizationIris.push(orgIri);
      }
    }
  }

  return { graph, personIris, organizationIris };
}