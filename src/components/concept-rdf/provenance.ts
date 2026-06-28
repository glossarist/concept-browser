import type { RdfGraph } from './rdf-graph';
import { PROV, DCTERMS, XSD } from './predicates';

/**
 * Provenance information attached to every emitted concept graph.
 *
 * The `toolId` and `toolVersion` identify the serializer that produced
 * the document; together they form the PROV-O activity IRI
 * (`<activity/serializers/{toolId}/{version}>`). The `generatedAt`
 * timestamp is when this document came into existence — at build
 * time for static dumps, at view time for client-side emission.
 *
 * `canonicalUri` is the unversioned concept URI; `dcterms:isVersionOf`
 * points there from the versioned concept resource.
 */
export interface ProvenanceOptions {
  readonly toolId: string;
  readonly toolVersion: string;
  readonly generatedAt: string;
  readonly canonicalUri?: string;
}

export const SERIALIZER_TOOL_ID = 'concept-browser';

/**
 * Compose the PROV-O activity IRI for a given tool + version. Format:
 * `activity/serializers/{toolId}/{version}`. This is a relative IRI;
 * under the document base it resolves to a per-tool activity resource.
 */
export function activityUri(opts: ProvenanceOptions): string {
  return `activity/serializers/${opts.toolId}/${opts.toolVersion}`;
}

/**
 * Attach provenance triples to the concept resource identified by
 * `subjectUri` in `graph`. Idempotent — calling twice with the same
 * arguments produces the same single set of triples (the underlying
 * RdfGraph deduplicates).
 *
 * The decorator is invoked AFTER the base emitter has populated the
 * graph, keeping domain emission (concept-emitter.ts) decoupled from
 * build/render context (timestamp, tool version). See ADR 0001 for
 * the rationale.
 */
export function decorateWithProvenance(
  graph: RdfGraph,
  subjectUri: string,
  opts: ProvenanceOptions,
): void {
  const w = graph.declare(subjectUri, {});
  w.iri(PROV.wasGeneratedBy, activityUri(opts));
  w.literal(PROV.generatedAtTime, opts.generatedAt, { datatype: XSD.dateTime });
  if (opts.canonicalUri && opts.canonicalUri !== subjectUri) {
    w.iri(DCTERMS.isVersionOf, opts.canonicalUri);
  }

  graph.declare(activityUri(opts), {
    types: [PROV.Activity],
    label: `${opts.toolId} ${opts.toolVersion}`,
  });
}

/**
 * Build ProvenanceOptions for runtime emission in the browser. Uses
 * the current wall-clock time as `generatedAt`. Callers that want a
 * deterministic timestamp (e.g., build scripts, snapshot tests)
 * should construct the options directly.
 */
export function runtimeProvenance(
  toolVersion: string,
  canonicalUri?: string,
  now: () => Date = () => new Date(),
): ProvenanceOptions {
  return {
    toolId: SERIALIZER_TOOL_ID,
    toolVersion,
    generatedAt: now().toISOString(),
    canonicalUri,
  };
}
