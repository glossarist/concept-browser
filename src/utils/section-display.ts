import type { SectionNode } from '../adapters/types';

interface SectionLike {
  id: string;
  names?: Record<string, string>;
}

export function sectionName(section: SectionLike, lang: string): string {
  const names = section.names || {};
  return names[lang] || names.eng || section.id;
}

export function formatSectionLabel(section: SectionLike, lang: string): string {
  const names = section.names || {};
  const name = names[lang] || names.eng || '';
  const bare = section.id;
  if (!name) return bare;
  if (name === bare) return name;
  if (name === bare.replace(/_/g, ' ')) return name;
  return `${bare} — ${name}`;
}
