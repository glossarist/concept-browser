import type { LocalizedConcept } from 'glossarist';
import { ontology } from '../adapters/ontology-registry';

export function entryStatusColor(status: string): string {
  return ontology.getColor('entryStatus', status) ?? 'badge-gray';
}

export function conceptStatusColor(status: string | null): string {
  if (!status) return 'badge-gray';
  return ontology.getColor('conceptStatus', status) ?? 'badge-gray';
}

export function conceptStatusLabel(status: string | null): string {
  if (!status) return '';
  return ontology.getLabel('conceptStatus', status) || status;
}

export function conceptStatusDefinition(status: string | null): string | null {
  if (!status) return null;
  return ontology.getDefinition('conceptStatus', status);
}

export function entryStatusLabel(status: string | null): string {
  if (!status) return '';
  return ontology.getLabel('entryStatus', status) || status;
}

export function entryStatusDefinition(status: string | null): string | null {
  if (!status) return null;
  return ontology.getDefinition('entryStatus', status);
}

export function getPreferredTerm(lc: LocalizedConcept | null | undefined, fallback = '—'): string {
  if (!lc) return fallback;
  return lc.primaryDesignation ?? lc.terms[0]?.designation ?? fallback;
}
