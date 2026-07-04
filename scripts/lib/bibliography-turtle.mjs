import { ttlLit, ttlIri } from './turtle-escape.mjs';

function entryFromV3(e, fallbackId) {
  return {
    id: e.id ?? fallbackId ?? '',
    reference: e.reference ?? '',
    title: e.title,
    link: e.link,
    type: e.type,
  };
}

export function normalizeBibliographyData(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw.bibliography)) {
    return raw.bibliography.map(e => entryFromV3(e));
  }
  const entries = [];
  for (const [id, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    entries.push(entryFromV3(value, id));
  }
  return entries;
}

export function buildBibliographyTurtle(register, bibliographyJson, baseUri = 'https://glossarist.org') {
  const lines = [
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
    '@prefix gloss: <https://www.glossarist.org/ontologies/> .',
    '',
  ];

  const datasetIri = `${baseUri}/${register}/`;
  const entries = normalizeBibliographyData(bibliographyJson);

  for (const entry of entries) {
    if (!entry.id || !entry.reference) continue;
    /* Percent-encode the bib id when embedding it in an IRI — many
       bibliography ids contain spaces or other reserved chars
       (e.g. "ISO/IEC 17000:2020") which are forbidden in raw IRI form. */
    const bibIri = `${datasetIri}bib/${encodeURIComponent(entry.id)}`;
    lines.push(`${ttlIri(bibIri)} a dcterms:BibliographicResource ;`);
    lines.push(`  dcterms:identifier ${ttlLit(entry.id)} ;`);
    lines.push(`  dcterms:bibliographicCitation ${ttlLit(entry.reference)} ;`);
    if (entry.title) lines.push(`  dcterms:title ${ttlLit(entry.title)} ;`);
    if (entry.link) lines.push(`  foaf:page ${ttlIri(entry.link)} ;`);
    if (entry.type) lines.push(`  dcterms:type ${ttlIri(`${baseUri}/${register}/bibtype/${entry.type}`)} ;`);
    lines.push(`  dcterms:isPartOf ${ttlIri(datasetIri)} .`);
    lines.push('');
  }

  return lines.join('\n');
}