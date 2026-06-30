function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildBibliographyTurtle(register, bibliographyJson, baseUri = 'https://glossarist.org') {
  const lines = [];
  lines.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  lines.push('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
  lines.push('');

  const datasetIri = `${baseUri}/${register}/`;

  for (const [id, entry] of Object.entries(bibliographyJson ?? {})) {
    if (!entry || typeof entry !== 'object') continue;
    const bibIri = `${datasetIri}bib/${id}`;
    lines.push(`<${bibIri}> a dcterms:BibliographicResource ;`);
    lines.push(`  dcterms:identifier ${ttlLit(id)} ;`);
    if (entry.reference) {
      lines.push(`  dcterms:bibliographicCitation ${ttlLit(entry.reference)} ;`);
    }
    if (entry.title) {
      lines.push(`  dcterms:title ${ttlLit(entry.title)} ;`);
    }
    if (entry.link) {
      lines.push(`  foaf:page <${entry.link}> ;`);
    }
    lines.push(`  dcterms:isPartOf <${datasetIri}> .`);
    lines.push('');
  }

  return lines.join('\n');
}