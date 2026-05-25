import type { Designation, Abbreviation } from 'glossarist';
import type { GrammarInfo, Pronunciation } from 'glossarist/models';
import { ontology } from '../adapters/ontology-registry';

export interface DesignationTypeInfo {
  label: string;
  color: string;
  definition?: string;
}

const TYPE_COLORS: Record<string, string> = {
  expression: 'bg-sky-50 text-sky-700',
  abbreviation: 'bg-amber-50 text-amber-700',
  symbol: 'bg-violet-50 text-violet-700',
  letter_symbol: 'bg-violet-50 text-violet-700',
  graphical_symbol: 'bg-violet-50 text-violet-700',
};

export function designationTypeInfo(designation: Designation): DesignationTypeInfo {
  const type = designation.type;
  const concept = ontology.getConcept('designationType', type);
  return {
    label: concept?.prefLabel ?? type,
    color: TYPE_COLORS[type] ?? 'bg-gray-50 text-gray-700',
    definition: concept?.definition ?? undefined,
  };
}

export function normativeStatusInfo(status: string | null): { label: string; color: string; definition?: string } {
  if (!status) return { label: '', color: 'bg-gray-50 text-gray-700' };

  const colors: Record<string, string> = {
    preferred: 'bg-emerald-50 text-emerald-700',
    admitted: 'bg-amber-50 text-amber-700',
    deprecated: 'bg-red-50 text-red-700',
    superseded: 'bg-red-50 text-red-700',
  };

  const concept = ontology.getConcept('normativeStatus', status);
  return {
    label: concept?.prefLabel ?? status,
    color: colors[status] ?? 'bg-gray-50 text-gray-700',
    definition: concept?.definition ?? undefined,
  };
}

export function sourceStatusInfo(status: string | null): { label: string; color: string; definition?: string } {
  if (!status) return { label: '', color: 'badge-gray' };

  const concept = ontology.getConcept('sourceStatus', status);
  return {
    label: concept?.prefLabel ?? status,
    color: 'badge-gray',
    definition: concept?.definition ?? undefined,
  };
}

export function sourceTypeInfo(type: string | null): { label: string; color: string; definition?: string } {
  if (!type) return { label: '', color: 'badge-gray' };

  const colors: Record<string, string> = {
    authoritative: 'badge-purple',
    lineage: 'badge-blue',
  };

  const concept = ontology.getConcept('sourceType', type);
  return {
    label: concept?.prefLabel ?? type,
    color: colors[type] ?? 'badge-gray',
    definition: concept?.definition ?? undefined,
  };
}

export function termTypeInfo(termType: string | null): { label: string; category: string; definition?: string } {
  if (!termType) return { label: '', category: '' };
  const concept = ontology.getConcept('termType', termType);
  return {
    label: concept?.prefLabel ?? termType,
    category: concept?.broader ?? '',
    definition: concept?.definition ?? undefined,
  };
}

export function abbreviationDetails(designation: Designation): string[] {
  if (designation.type !== 'abbreviation') return [];
  const abbr = designation as Abbreviation;
  const parts: string[] = [];
  if (abbr.acronym) parts.push('acronym');
  if (abbr.initialism) parts.push('initialism');
  if (abbr.truncation) parts.push('truncation');
  return parts;
}

export function grammarBadges(gi: GrammarInfo): { label: string; definition?: string }[] {
  const badges: { label: string; definition?: string }[] = [];
  if (gi.gender) {
    const concept = ontology.getConcept('grammarGender', gi.gender);
    badges.push({ label: concept?.prefLabel ?? gi.gender, definition: concept?.definition ?? undefined });
  }
  if (gi.number) {
    const concept = ontology.getConcept('grammarNumber', gi.number);
    badges.push({ label: concept?.prefLabel ?? gi.number, definition: concept?.definition ?? undefined });
  }
  if (gi.partOfSpeech) badges.push({ label: gi.partOfSpeech });
  for (const pos of ['noun', 'verb', 'adj', 'adverb', 'preposition', 'participle'] as const) {
    if (gi[pos]) badges.push({ label: pos });
  }
  return badges;
}

export function pronunciationLabel(p: Pronunciation): string {
  const parts = [p.content];
  if (p.system) parts.push(`(${p.system})`);
  return parts.filter(Boolean).join(' ');
}

export function pronunciationTooltip(p: Pronunciation): string {
  const parts: string[] = [];
  if (p.language) parts.push(`Language: ${p.language}`);
  if (p.script) parts.push(`Script: ${p.script}`);
  if (p.country) parts.push(`Country: ${p.country}`);
  if (p.system) parts.push(`System: ${p.system}`);
  return parts.join(', ');
}
