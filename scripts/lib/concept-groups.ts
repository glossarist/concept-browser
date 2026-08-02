export function getGroups(conceptYaml) {
  if (conceptYaml.eng && conceptYaml.eng.groups) return conceptYaml.eng.groups;
  if (conceptYaml._domains) {
    const sectionIds = conceptYaml._domains
      .filter(d => d.ref_type === 'section' && d.concept_id)
      .map(d => d.concept_id.replace(/^section-/, ''));
    if (sectionIds.length) return sectionIds;
  }
  const termid = String(conceptYaml.termid);
  if (/^\d{3}-/.test(termid)) return [termid.substring(0, 3)];
  if (/^\d+\.\d+\.\d+/.test(termid)) {
    const parts = termid.split('.');
    return [`${parts[0]}.${parts[1]}.${parts[2]}`];
  }
  return [];
}
