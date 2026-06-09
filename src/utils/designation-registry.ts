import type { Designation, Abbreviation } from 'glossarist';
import type { GrammarInfo, Pronunciation } from 'glossarist/models';
import { ontology } from '../adapters/ontology-registry';

export interface DesignationTypeInfo {
  label: string;
  color: string;
  definition?: string;
}

export function designationTypeInfo(designation: Designation): DesignationTypeInfo {
  return ontology.getDisplay('designationType', designation.type, 'bg-gray-50 text-gray-700');
}

export function normativeStatusInfo(status: string | null): { label: string; color: string; definition?: string } {
  return ontology.getDisplay('normativeStatus', status, 'bg-gray-50 text-gray-700');
}

export function sourceStatusInfo(status: string | null): { label: string; color: string; definition?: string } {
  return ontology.getDisplay('sourceStatus', status, 'badge-gray');
}

export function sourceTypeInfo(type: string | null): { label: string; color: string; definition?: string } {
  return ontology.getDisplay('sourceType', type, 'badge-gray');
}

export function termTypeInfo(termType: string | null): { label: string; category: string; definition?: string } {
  if (!termType) return { label: '', category: '' };
  const display = ontology.getDisplay('termType', termType);
  return {
    label: display.label,
    category: ontology.getBroader('termType', termType) ?? '',
    definition: display.definition,
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

const GRAMMAR_BOOLEAN_POS = ['noun', 'verb', 'adj', 'adverb', 'preposition', 'participle'] as const;

export function grammarBadges(gi: GrammarInfo): { label: string; definition?: string }[] {
  const badges: { label: string; definition?: string }[] = [];
  if (gi.gender) {
    const display = ontology.getDisplay('grammarGender', gi.gender);
    badges.push({ label: display.label, definition: display.definition });
  }
  if (gi.number) {
    const display = ontology.getDisplay('grammarNumber', gi.number);
    badges.push({ label: display.label, definition: display.definition });
  }
  if (gi.partOfSpeech) badges.push({ label: gi.partOfSpeech });
  for (const pos of GRAMMAR_BOOLEAN_POS) {
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
