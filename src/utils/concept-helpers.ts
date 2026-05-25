import type { LocalizedConcept } from 'glossarist';
import { ontology } from '../adapters/ontology-registry';

export function entryStatusColor(status: string): string {
  const colors: Record<string, string> = {
    valid: 'badge-green',
    not_valid: 'bg-red-50 text-red-700',
    superseded: 'bg-red-50 text-red-700',
    retired: 'badge-gray',
    withdrawn: 'bg-red-100 text-red-800',
    draft: 'badge-yellow',
    Standard: 'badge-green',
  };
  return colors[status] ?? 'badge-gray';
}

export function conceptStatusColor(status: string | null): string {
  if (!status) return 'badge-gray';
  const colors: Record<string, string> = {
    draft: 'badge-yellow',
    submitted: 'badge-blue',
    valid: 'badge-green',
    not_valid: 'bg-red-50 text-red-700',
    invalid: 'bg-red-50 text-red-700',
    superseded: 'bg-red-50 text-red-700',
    retired: 'badge-gray',
  };
  return colors[status] ?? 'badge-gray';
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
