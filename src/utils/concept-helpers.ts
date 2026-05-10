import type { Designation, LocalizedConcept } from '../adapters/types';

export function entryStatusColor(status: string): string {
  if (status === 'valid' || status === 'Standard') return 'badge-green';
  if (status === 'superseded') return 'bg-red-50 text-red-700';
  if (status === 'withdrawn') return 'bg-red-100 text-red-800';
  if (status === 'draft') return 'badge-yellow';
  return 'badge-gray';
}

export function designationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'gl:Expression': 'Expression',
    'gl:Symbol': 'Symbol',
    'gl:Abbreviation': 'Abbreviation',
    'gl:GraphicalSymbol': 'Graphical',
  };
  return labels[type] ?? type;
}

export function designationTypeColor(type: string): string {
  if (type === 'gl:Symbol') return 'badge-purple';
  if (type === 'gl:Abbreviation') return 'badge-yellow';
  return 'badge-blue';
}

export function getPreferredTerm(lc: LocalizedConcept | null | undefined, fallback = '—'): string {
  if (!lc?.['gl:designation']?.length) return fallback;
  const desigs = lc['gl:designation'];
  const preferredExpr = desigs.find(d => d['gl:normativeStatus'] === 'preferred' && d['@type'] === 'gl:Expression');
  if (preferredExpr) return preferredExpr['gl:term'];
  const preferred = desigs.find(d => d['gl:normativeStatus'] === 'preferred');
  return preferred?.['gl:term'] ?? desigs[0]?.['gl:term'] ?? fallback;
}
