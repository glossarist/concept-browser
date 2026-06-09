import type { LocalizedConcept } from 'glossarist';
import { ontology } from '../adapters/ontology-registry';

export function entryStatusColor(status: string): string {
  return ontology.getDisplay('entryStatus', status).color;
}

export function conceptStatusColor(status: string | null): string {
  return ontology.getDisplay('conceptStatus', status).color;
}

export function conceptStatusLabel(status: string | null): string {
  return ontology.getDisplay('conceptStatus', status).label;
}

export function conceptStatusDefinition(status: string | null): string | null {
  if (!status) return null;
  return ontology.getDefinition('conceptStatus', status);
}

export function entryStatusLabel(status: string | null): string {
  return ontology.getDisplay('entryStatus', status).label;
}

export function entryStatusDefinition(status: string | null): string | null {
  if (!status) return null;
  return ontology.getDefinition('entryStatus', status);
}

export function getPreferredTerm(lc: LocalizedConcept | null | undefined, fallback = '—'): string {
  if (!lc) return fallback;
  return lc.primaryDesignation ?? lc.terms[0]?.designation ?? fallback;
}
