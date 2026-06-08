/**
 * Relationship categorization — fully derived from the ontology taxonomy.
 *
 * RELATIONSHIP_CATEGORIES, INVERSE_RELATIONSHIPS, and the category lookup
 * map are all computed from `taxonomies.json` at module load time.
 * Adding a new relationship type requires only a taxonomy edit — no code changes.
 */
import { ontology } from '../adapters/ontology-registry';
import type { TaxonomyCategory } from '../adapters/ontology-registry';

export interface RelationshipCategory {
  id: string;
  label: string;
  types: string[];
  color: string;
}

// ── Derived data ──────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  'hierarchical', 'mapping', 'associative', 'lifecycle',
  'comparative', 'definitional', 'spatiotemporal', 'lexical', 'designation',
] as const;

function buildRelationshipData() {
  const allTypes = ontology.getAll('relationshipType');
  const categoryTypes = new Map<string, string[]>();
  const inverseMap: Record<string, string> = {};

  for (const concept of allTypes) {
    if (concept.inverseOf) {
      inverseMap[concept.id] = concept.inverseOf;
    }

    if (concept.category) {
      const list = categoryTypes.get(concept.category) ?? [];
      list.push(concept.id);
      categoryTypes.set(concept.category, list);
    }
  }

  const categories: RelationshipCategory[] = [];
  for (const catId of CATEGORY_ORDER) {
    const types = categoryTypes.get(catId);
    if (!types) continue;
    const config = ontology.getCategoryConfig('relationshipType', catId);
    categories.push({
      id: catId,
      label: config?.label ?? catId,
      types,
      color: config?.color ?? 'text-gray-600 bg-gray-50',
    });
  }

  // Add any categories not in the canonical order
  for (const [catId, types] of categoryTypes) {
    if (categories.some(c => c.id === catId)) continue;
    const config = ontology.getCategoryConfig('relationshipType', catId);
    categories.push({
      id: catId,
      label: config?.label ?? catId,
      types,
      color: config?.color ?? 'text-gray-600 bg-gray-50',
    });
  }

  return { categories, inverseMap };
}

const { categories: RELATIONSHIP_CATEGORIES, inverseMap: INVERSE_RELATIONSHIPS } = buildRelationshipData();

export { RELATIONSHIP_CATEGORIES, INVERSE_RELATIONSHIPS };

// ── Lookup maps ───────────────────────────────────────────────────────────

const CATEGORY_MAP = new Map<string, RelationshipCategory>();
for (const cat of RELATIONSHIP_CATEGORIES) {
  for (const t of cat.types) {
    CATEGORY_MAP.set(t, cat);
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export function categorizeRelationship(type: string): RelationshipCategory {
  return CATEGORY_MAP.get(type) ?? { id: 'other', label: 'Other', types: [type], color: 'text-gray-600 bg-gray-50' };
}

export function relationshipLabel(type: string): string {
  const concept = ontology.getConcept('relationshipType', type);
  if (concept?.prefLabel) return concept.prefLabel;
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function relationshipDefinition(type: string): string | null {
  return ontology.getDefinition('relationshipType', type);
}
