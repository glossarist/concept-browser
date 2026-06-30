function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function ttlPrefixed(qname) {
  const colonIdx = qname.indexOf(':');
  if (colonIdx < 0) return qname;
  const local = qname.slice(colonIdx + 1);
  const escaped = local.replace(/([/])/g, '\\$1');
  return `${qname.slice(0, colonIdx + 1)}${escaped}`;
}

export function buildAgentsTurtle(contributors, agentBase = 'https://glossarist.org/agent') {
  const lines = [];
  lines.push('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
  lines.push('@prefix prov: <http://www.w3.org/ns/prov#> .');
  lines.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  lines.push('@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .');
  lines.push('');

  const orgSlugs = new Set();
  for (const c of contributors ?? []) {
    const slug = slugify(c.name);
    const iri = `${agentBase}/${slug}`;
    const personLines = [
      `<${iri}> a foaf:Person, prov:Person, prov:Agent ;`,
      `  foaf:name ${ttlLit(c.name)} ;`,
    ];
    if (c.email) personLines.push(`  foaf:mbox <mailto:${c.email}> ;`);
    if (c.url) personLines.push(`  rdfs:seeAlso <${c.url}> ;`);
    if (c.role) personLines.push(`  dcterms:description ${ttlLit(c.role)} ;`);
    personLines[personLines.length - 1] = personLines[personLines.length - 1].replace(/ ;$/, ' .');
    lines.push(...personLines);

    if (c.organization) {
      const orgSlug = slugify(c.organization);
      const orgIri = `https://glossarist.org/org/${orgSlug}`;
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\.$/, ` ;\n  prov:actedOnBehalfOf <${orgIri}> .`);

      if (!orgSlugs.has(orgSlug)) {
        orgSlugs.add(orgSlug);
        const orgLines = [
          ``,
          `<${orgIri}> a foaf:Organization, prov:Organization, prov:Agent ;`,
          `  foaf:name ${ttlLit(c.organization)} .`,
        ];
        lines.push(...orgLines);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}