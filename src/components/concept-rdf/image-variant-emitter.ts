import { FOAF, DCTERMS, DCAT, XSD } from './predicates';
import { RdfGraph } from './rdf-graph';

export interface ImageVariantInput {
  readonly registerId: string;
  readonly figureId: string;
  readonly lang?: string;
  readonly format: 'svg' | 'png' | 'webp' | 'jpg' | 'gif';
  readonly byteSize?: number;
  readonly downloadUrl: string;
}

export function imageVariantIri(input: ImageVariantInput, baseUri = 'https://glossarist.org'): string {
  const ext = input.format;
  const langSuffix = input.lang ? `${input.lang}.` : '';
  return `${baseUri}/${input.registerId}/image/${input.figureId}/${langSuffix}${ext}`;
}

export function emitImageVariantGraph(input: ImageVariantInput, baseUri = 'https://glossarist.org'): RdfGraph {
  const graph = new RdfGraph();
  const iri = imageVariantIri(input, baseUri);
  const mimeType = mimeForFormat(input.format);
  const w = graph.declare(iri, {
    types: [FOAF.Image],
    label: `${input.figureId} (${input.format}${input.lang ? `/${input.lang}` : ''})`,
    classLabel: 'Image',
    classId: FOAF.Image,
  });
  w.literal(DCTERMS.format, mimeType);
  if (input.lang) w.literal(DCTERMS.language, input.lang);
  if (input.byteSize != null) {
    w.literal(DCAT.byteSize, String(input.byteSize), { datatype: XSD.integer });
  }
  w.iri(DCAT.downloadURL, input.downloadUrl);
  return graph;
}

function mimeForFormat(format: ImageVariantInput['format']): string {
  switch (format) {
    case 'svg':  return 'image/svg+xml';
    case 'png':  return 'image/png';
    case 'webp': return 'image/webp';
    case 'jpg':  return 'image/jpeg';
    case 'gif':  return 'image/gif';
  }
}